/**
 * CSV Parser Service
 * Handles parsing CSV files with time-series data
 */

export interface CSVData {
  headers: string[];
  rows: Record<string, string | number>[];
}

export interface TimeSeriesData {
  seriesData: number[][];
  type: 'time-series';
}

export class CSVParser {
  /**
   * Parse CSV string data into structured format
   */
  static parseCSV(csvContent: string): CSVData {
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('Empty CSV content');
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Parse rows
    const rows: Record<string, string | number>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string | number> = {};
      
      headers.forEach((header, idx) => {
        const value = values[idx];
        // Try to parse as number, otherwise keep as string
        row[header] = isNaN(Number(value)) ? value : Number(value);
      });
      
      rows.push(row);
    }

    return { headers, rows };
  }

  /**
   * Convert parsed CSV data to time-series format
   * Expects columns: time, channel_0, channel_1, ..., channel_N
   */
  static csvToTimeSeries(csvData: CSVData, channelCount: number = 10): TimeSeriesData {
    const seriesData: number[][] = [];

    // Initialize arrays for each channel
    for (let i = 0; i < channelCount; i++) {
      seriesData[i] = [];
    }

    // Extract channel data from rows
    csvData.rows.forEach(row => {
      for (let i = 0; i < channelCount; i++) {
        const channelKey = `channel_${i}`;
        const value = row[channelKey];
        if (typeof value === 'number') {
          seriesData[i].push(value);
        }
      }
    });

    return {
      seriesData,
      type: 'time-series'
    };
  }

  /**
   * Parse CSV content and convert to time-series format in one step
   */
  static parseCSVToTimeSeries(csvContent: string, channelCount: number = 10): TimeSeriesData {
    const csvData = this.parseCSV(csvContent);
    return this.csvToTimeSeries(csvData, channelCount);
  }
}
