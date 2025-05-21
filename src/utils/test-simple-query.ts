import { BigQuery } from '@google-cloud/bigquery';

async function testSimpleQuery() {
  const bq = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    location: 'US'
  });

  const [rows] = await bq.query({
    query: `
      SELECT
        COUNT(*) AS cnt
      FROM
        \`bigquery-public-data.samples.shakespeare\`
      LIMIT 1
    `,
    location: 'US',
  });

  console.log('Query results:', rows);
}

// Run the test
testSimpleQuery().catch(console.error); 