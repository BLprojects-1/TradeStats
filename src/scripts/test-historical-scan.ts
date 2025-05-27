import { historicalPriceService } from '../services/historicalPriceService';

async function testHistoricalScan() {
  try {
    // Using a test wallet address
    const walletAddress = 'LT42y5yGt13TJUR8iLBu3y37PPYAB32GzDhMCQvJvEX'; // Example Solana wallet
    
    console.log('Starting historical scan...');
    const result = await historicalPriceService.analyzeWalletTrades(walletAddress);
    
    console.log('\n=== Scan Results ===');
    console.log(`Total Trades Found: ${result.totalTrades}`);
    console.log(`Total Volume: $${result.totalVolume.toFixed(2)}`);
    console.log(`Unique Tokens: ${result.uniqueTokens.size}`);
    
    console.log('\n=== Recent Trades ===');
    result.recentTrades.forEach((trade, index) => {
      console.log(`\nTrade #${index + 1}:`);
      console.log(`Type: ${trade.type}`);
      console.log(`Token: ${trade.tokenName} (${trade.tokenSymbol})`);
      console.log(`Amount: ${trade.tokenChange}`);
      console.log(`SOL Amount: ${trade.solAmount}`);
      console.log(`USD Value: $${trade.usdValue.toFixed(2)}`);
      console.log(`Timestamp: ${new Date(trade.timestamp).toLocaleString()}`);
    });
    
  } catch (error) {
    console.error('Error running historical scan:', error);
  }
}

testHistoricalScan(); 