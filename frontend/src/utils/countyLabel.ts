/**
 * County display-label helper.
 *
 * Backend data is inconsistent — some names already include ", State", others don't.
 * This normalizes: always return "County Name, State Name".
 */

const STATE_FIPS: Record<string, string> = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
  '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
  '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
  '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
  '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
  '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
  '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
  '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
  '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
  '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
  '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
  '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
  '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming',
  '60': 'American Samoa', '66': 'Guam', '69': 'Northern Mariana Islands',
  '72': 'Puerto Rico', '78': 'U.S. Virgin Islands',
}

export function stateFromFips(fips: string): string | undefined {
  if (!fips || fips.length < 2) return undefined
  return STATE_FIPS[fips.slice(0, 2)]
}

export function countyLabel(county: { county_name: string; county_fips: string }): string {
  const name = (county.county_name || '').trim()
  if (!name) return ''
  if (name.includes(',')) return name
  const state = stateFromFips(county.county_fips)
  return state ? `${name}, ${state}` : name
}
