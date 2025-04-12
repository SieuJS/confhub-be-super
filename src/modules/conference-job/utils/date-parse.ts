import parser from "any-date-parser";
import { toArray } from "rxjs";
import { ConferenceDateInput } from "src/modules/conference-organization/models/date/conferencer-date.input";
export function parseDateRange(dateRange: string): [Date | null, Date | null] {
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
        return [null, null];
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
  if (!lastDate.isValid()) 
    return [null, null];

  // If firstPart lacks a year, inherit from lastDate
  let firstDate = parser.fromString(firstPart);
  
  if (!firstDate.isValid()) {

    firstPart += ` ${lastDate.getFullYear()}`;
    firstDate = parser.fromString(firstPart);
  }

  if (!firstDate.isValid()) return [null, null];


  return [firstDate, lastDate];
}

export const converStringToDate = (
  date: string,
  type: string,
  organizedId
): ConferenceDateInput => {
  const [fromDate, toDate] = parseDateRange(date);
  return  ({
          fromDate,
          toDate,
          type,
          name: type,
          organizedId,
      })
};

export const convertObjectToDate = (
  date: object,
  type: string,
  organizedId
): ConferenceDateInput[] => {
  const result: ConferenceDateInput[] = [];
  for (const key  in Object.getOwnPropertyNames(date)) {

      if (!date[key]) continue;
      const [fromDate, toDate] = parseDateRange(date[key]);
      if(!fromDate || !toDate) continue;
      result.push({
          fromDate,
          toDate,
          type,
          name: key,
          organizedId,
      }); 
      break;
  }
  return result;
};


