import parser from "any-date-parser";
export function parseDateRange(dateRange: string): [Date, Date] {
  // Normalize dash types and remove any extra spaces
  dateRange = dateRange.replace("–", "-").replace(/\s*,\s*/g, ", ").trim();

  let parts = dateRange.split(" - ");
  
  // If splitting by " - " fails, attempt to split by "–" (for cases like "October 16–19, 2024")
  if (parts.length === 1) {
    parts = dateRange.split("-");
  }
  if (parts.length !== 2) {
    let singleDate =  parser.fromString(dateRange);
    if(!singleDate.isValid())
      singleDate = parser.fromString('1' + dateRange);
      if(!singleDate.isValid())
      {
        throw new Error(`Invalid date range format: ${dateRange}`);
      }
    else 
      return [singleDate, singleDate]
  }

  let firstPart = parts[0].trim();
  let lastPart =firstPart.split(' ')[0] +" " + parts[1].trim() ;
  // Ensure that lastPart includes a year
  firstPart += ' ' + lastPart.split(' ')[2];

  let lastDate = parser.fromString(lastPart);
  if(! lastDate.isValid()) {
    lastPart = firstPart.split(' ')[0] + lastPart
    lastDate = parser.fromString(lastPart)
  }
  if (!lastDate) throw new Error(`Could not parse the end date: ${lastPart}`);

  // If firstPart lacks a year, inherit from lastDate
  let firstDate = parser.fromString(firstPart);
  
  if (!firstDate) {

    firstPart += ` ${lastDate.getFullYear()}`;
    firstDate = parser.fromString(firstPart);
  }

  if (!firstDate) throw new Error(`Could not parse the start date: ${firstPart}`);

  return [firstDate, lastDate];
}