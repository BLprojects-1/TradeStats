import { BigQuery } from '@google-cloud/bigquery';

// Initialize BigQuery client using environment variables
const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  location: 'US'
});

/**
 * Interface representing a processed Solana transaction from BigQuery
 */
export interface SolanaTx {
  signature: string;      // Transaction signature
  blockTime: string;      // ISO timestamp of block
  slot: number;          // Slot number
  success: boolean;      // Whether the transaction succeeded
  fee: number;          // Transaction fee in lamports
  numInstructions: number; // Number of instructions in the transaction
}

/**
 * Test BigQuery access by creating and querying our own dataset
 * This version works within sandbox mode limitations
 */
export async function testBigQueryAccess(): Promise<boolean> {
  const datasetId = 'test_dataset';
  const tableId = 'test_table';

  try {
    // Step 1: Create a dataset
    console.log('\nStep 1: Creating test dataset...');
    try {
      const [dataset] = await bq.createDataset(datasetId, {
        location: 'US'
      });
      console.log(`Dataset ${dataset.id} created successfully.`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`Dataset ${datasetId} already exists.`);
      } else {
        throw error;
      }
    }

    // Step 2: Create a table (without partitioning in sandbox mode)
    console.log('\nStep 2: Creating test table...');
    try {
      const schema = [
        { name: 'timestamp', type: 'TIMESTAMP' },
        { name: 'value', type: 'STRING' }
      ];

      const [table] = await bq.dataset(datasetId).createTable(tableId, {
        schema: schema,
        location: 'US'
      });
      console.log(`Table ${table.id} created successfully.`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`Table ${tableId} already exists.`);
      } else {
        throw error;
      }
    }

    // Step 3: Load test data using a query
    console.log('\nStep 3: Loading test data...');
    const [loadJob] = await bq.query({
      query: `
        INSERT INTO \`${process.env.GCP_PROJECT_ID}.${datasetId}.${tableId}\`
        (timestamp, value)
        VALUES
        (CURRENT_TIMESTAMP(), 'test_value')
      `,
      location: 'US'
    });
    console.log('Test data loaded successfully.');

    // Step 4: Query the data
    console.log('\nStep 4: Querying test data...');
    const [rows] = await bq.query({
      query: `
        SELECT *
        FROM \`${process.env.GCP_PROJECT_ID}.${datasetId}.${tableId}\`
        WHERE value = 'test_value'
        ORDER BY timestamp DESC
        LIMIT 1
      `,
      location: 'US'
    });
    
    console.log('Query results:', rows);
    
    // Step 5: Clean up
    console.log('\nStep 5: Cleaning up...');
    await bq.dataset(datasetId).table(tableId).delete();
    await bq.dataset(datasetId).delete();
    console.log('Test resources cleaned up successfully.');
    
    return true;
  } catch (error) {
    console.error('Error testing BigQuery access:', error);
    return false;
  }
}

/**
 * Queries the public Solana dataset in BigQuery for wallet transactions
 * Uses table: bigquery-public-data.crypto_solana_mainnet_us.Transactions
 * 
 * @param wallet - The wallet address to query transactions for
 * @param limit - Optional maximum number of transactions to return (default: 50)
 * @param startDate - Optional ISO date string for start of date range
 * @param endDate - Optional ISO date string for end of date range
 * @returns Array of processed transactions matching the query criteria
 */
export async function queryWalletTransactions(
  wallet: string,
  limit?: number,
  startDate?: string,
  endDate?: string
): Promise<SolanaTx[]> {
  console.log(`\nQuerying transactions for wallet ${wallet}...`);
  console.log(`Parameters: limit=${limit}, startDate=${startDate}, endDate=${endDate}`);

  const [rows] = await bq.query({
    query: `
      SELECT
        signature,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', block_timestamp) as blockTime,
        block_slot as slot,
        CASE WHEN status = 'Success' THEN true ELSE false END as success,
        fee,
        ARRAY_LENGTH(log_messages) as numInstructions
      FROM \`bigquery-public-data.crypto_solana_mainnet_us.Transactions\`
      WHERE DATE(block_timestamp) >= DATE(@startDate)
        AND DATE(block_timestamp) <= DATE(@endDate)
        AND EXISTS(
          SELECT 1 
          FROM UNNEST(accounts) account 
          WHERE account.pubkey = @wallet
        )
      ORDER BY block_timestamp DESC
      LIMIT @limit
    `,
    params: {
      wallet,
      limit: limit || 50,
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    },
    types: {
      wallet: 'STRING',
      limit: 'INT64',
      startDate: 'DATE',
      endDate: 'DATE',
    },
    location: 'US'
  });

  console.log(`\nQuery complete, found ${rows.length} transactions.`);
  
  return rows as SolanaTx[];
} 