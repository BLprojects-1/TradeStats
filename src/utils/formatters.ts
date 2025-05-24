// Shared formatting utilities for the dashboard

// Helper function to format token amounts with appropriate decimal places
export const formatTokenAmount = (amount: number, decimals = 6) => {
  // For very large numbers with many decimals, use appropriate formatting
  if (amount > 1_000_000) {
    return amount.toLocaleString(undefined, { 
      maximumFractionDigits: 2 
    });
  }
  
  // For large numbers, use fewer decimal places
  if (amount > 1000) {
    return amount.toLocaleString(undefined, { 
      maximumFractionDigits: 2 
    });
  }
  
  // For medium amounts (1-1000), show more decimals
  if (amount >= 1) {
    return amount.toLocaleString(undefined, { 
      maximumFractionDigits: 4 
    });
  }
  
  // For small amounts (<1), use decimals or significant digits based on size
  if (amount < 0.000001) {
    return amount.toExponential(4);
  }
  
  // For other small amounts, show up to 8 decimal places
  return amount.toLocaleString(undefined, { 
    maximumFractionDigits: 8
  });
};

// Helper function to format market cap values
export const formatMarketCap = (marketCap?: number) => {
  if (!marketCap || marketCap === 0) {
    return 'N/A';
  }
  
  // Format large numbers with abbreviations
  if (marketCap >= 1_000_000_000) {
    return `$${(marketCap / 1_000_000_000).toLocaleString(undefined, { 
      maximumFractionDigits: 1
    })}B`;
  } else if (marketCap >= 1_000_000) {
    return `$${(marketCap / 1_000_000).toLocaleString(undefined, { 
      maximumFractionDigits: 1
    })}M`;
  } else if (marketCap >= 1_000) {
    return `$${(marketCap / 1_000).toLocaleString(undefined, { 
      maximumFractionDigits: 1
    })}K`;
  } else {
    return `$${marketCap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
};

// Formatter for very small price numbers with superscript notation
export const formatSmallPrice = (price?: number) => {
  if (!price || price === 0) {
    return 'N/A';
  }
  
  // For normal-sized numbers, just format with $ sign
  if (price >= 0.01) {
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
  }
  
  // For very small numbers, format with leading zeros notation using superscript
  const priceStr = price.toString();
  const decimalParts = priceStr.split('.');
  
  if (decimalParts.length === 2) {
    const decimalPart = decimalParts[1];
    // Count leading zeros
    let leadingZeros = 0;
    for (let i = 0; i < decimalPart.length; i++) {
      if (decimalPart[i] === '0') {
        leadingZeros++;
      } else {
        break;
      }
    }
    
    if (leadingZeros >= 3) {
      // Convert number to superscript using Unicode characters
      const superscriptMap: { [key: string]: string } = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
      };
      
      const superscriptZeros = leadingZeros.toString()
        .split('')
        .map(digit => superscriptMap[digit])
        .join('');
      
      // Show digits after leading zeros
      const significantPart = decimalPart.substring(leadingZeros);
      // Try to get at least 2 digits after the zeros
      const digitsToShow = Math.min(2, significantPart.length);
      return `$0.0${superscriptZeros}${significantPart.substring(0, digitsToShow)}`;
    }
  }
  
  // For other small numbers, use standard formatting
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 8 })}`;
};

// Date and time formatters
export const formatDate = (timestamp: number | string | Date) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  } catch (err) {
    console.error('Error formatting date:', err);
    return 'Invalid Date';
  }
};

export const formatTime = (timestamp: number | string | Date) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  } catch (err) {
    console.error('Error formatting time:', err);
    return 'Invalid Time';
  }
}; 