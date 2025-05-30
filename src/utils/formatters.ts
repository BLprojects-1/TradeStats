// Shared formatting utilities for the dashboard

// Helper function to format token amounts with appropriate decimal places
export const formatTokenAmount = (amount: number, decimals = 6) => {
  // Handle zero or undefined
  if (amount === 0 || amount === undefined) {
    return '0.00';
  }

  // Get absolute value for formatting, we'll add sign back later
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  let formattedAmount: string;

  // For all numbers, use 2 decimal places
  formattedAmount = absAmount.toLocaleString(undefined, { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });

  // Add negative sign back if needed
  return isNegative ? '-' + formattedAmount : formattedAmount;
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
      // Show 3 digits after the zeros (increased from 2)
      const digitsToShow = Math.min(3, significantPart.length);
      return `$0.0${superscriptZeros}${significantPart.substring(0, digitsToShow)}`;
    }
  }

  // For other small numbers, use standard formatting with fewer decimal places
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 5 })}`;
};

// Formatter for price numbers with exactly 2 decimal places
export const formatPriceWithTwoDecimals = (price?: number) => {
  if (!price) {
    return '$0.00';
  }

  // Format with exactly 2 decimal places
  return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// Format time as "Xh Ym ago"
export const formatTimeAgo = (timestamp: number | string | Date) => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Convert to hours and minutes
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  } catch (err) {
    console.error('Error formatting time ago:', err);
    return 'Invalid Time';
  }
};
