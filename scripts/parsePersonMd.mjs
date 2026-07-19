/**
 * Parse SortItOutSI FM26 person page markdown (from WebFetch) into a bio object.
 */
import { normalizeDate, parseMoneyGbp } from '../src/game/playerBio.ts'

export function parsePersonMarkdown(md, nameHint) {
  const text = String(md)
  const idM = text.match(/\bID\s*\n?\s*(\d{5,})\b/i) || text.match(/\bID\s+(\d{5,})\b/i)
  // Compact header line style: "ID 28106491 Name Declan Rice Age 26 DOB ..."
  const header = text.match(
    /ID\s+(\d+)\s+Name\s+(.+?)\s+Age\s+(\d+)\s+DOB\s+(\S+)\s+Gender\s+(\S+)\s+Nationality\s+(.+?)\s+Contracted Club\s+(.+?)\s+Club Contract Type\s+(\S+)\s+Wage\s+(£[^\s]+)\s+Contract Expires\s+(\S+)\s+Contract Signed\s+(\S+)\s+Value\s+(£[^\s]+)\s+Estimated Cost\s+(£[^\s]+)\s+Position\s+(.+?)\s+Current Ability/i,
  )

  let bio = {
    fmId: idM?.[1] ?? null,
    name: nameHint ?? null,
    age: null,
    dob: null,
    gender: null,
    nationality: null,
    club: null,
    contractType: null,
    wageWeeklyGbp: null,
    contractExpires: null,
    contractSigned: null,
    valueGbp: null,
    estimatedCostGbp: null,
    fmPos: null,
    caRemaining: null,
    starRating: null,
    peaked: false,
    fixedPotential: null,
    injuryProne: null,
    releaseClauseGbp: null,
    developNote: null,
  }

  if (header) {
    bio = {
      ...bio,
      fmId: header[1],
      name: header[2].trim(),
      age: Number(header[3]),
      dob: normalizeDate(header[4]),
      gender: header[5],
      nationality: header[6].trim(),
      club: header[7].trim(),
      contractType: header[8],
      wageWeeklyGbp: parseMoneyGbp(header[9]),
      contractExpires: normalizeDate(header[10]),
      contractSigned: normalizeDate(header[11]),
      valueGbp: parseMoneyGbp(header[12]),
      estimatedCostGbp: parseMoneyGbp(header[13]),
      fmPos: header[14].trim(),
    }
  } else {
    // Fallback field-by-field
    const grab = (label) => {
      const re = new RegExp(label + '\\s+([^\\n]+)', 'i')
      const m = text.match(re)
      return m ? m[1].trim().split(/\s{2,}/)[0] : null
    }
    bio.name = grab('Name') ?? bio.name
    bio.age = Number(grab('Age')) || null
    bio.dob = normalizeDate(grab('DOB'))
    bio.gender = grab('Gender')
    bio.nationality = grab('Nationality')
    bio.club = grab('Contracted Club')
    bio.contractType = grab('Club Contract Type') || grab('Contract Type')
    bio.wageWeeklyGbp = parseMoneyGbp(grab('Wage'))
    bio.contractExpires = normalizeDate(grab('Contract Expires'))
    bio.contractSigned = normalizeDate(grab('Contract Signed'))
    bio.valueGbp = parseMoneyGbp(grab('Value'))
    bio.estimatedCostGbp = parseMoneyGbp(grab('Estimated Cost'))
    bio.fmPos = grab('Position')
  }

  const caRem = text.match(/CA Remaining\s+(\d+)/i)
  if (caRem) bio.caRemaining = Number(caRem[1])

  const stars = text.match(/rate .+? (\d+)\s*\/\s*5 stars/i)
  if (stars) bio.starRating = Number(stars[1])

  if (/has peaked and will not improve/i.test(text)) {
    bio.peaked = true
    bio.developNote = 'has peaked and will not improve in FM26'
  } else if (/unlikely to improve much/i.test(text)) {
    bio.developNote = 'unlikely to improve much in FM26'
  } else if (/potential ability to become rated/i.test(text)) {
    const m = text.match(/become rated (\d+)\s*\/\s*5/i)
    bio.developNote = m ? `potential to become ${m[1]}/5` : 'still developing'
  }

  if (/has fixed potential/i.test(text)) bio.fixedPotential = true
  else if (/has random potential/i.test(text)) bio.fixedPotential = false

  if (/is not injury prone/i.test(text)) bio.injuryProne = false
  else if (/is quite injury prone|is injury prone/i.test(text)) bio.injuryProne = true

  if (/does not have a minimum fee release clause/i.test(text)) {
    bio.releaseClauseGbp = null
  } else {
    const rc = text.match(/release clause[^.]*?(£[\d.]+[kmb]?)/i)
    if (rc) bio.releaseClauseGbp = parseMoneyGbp(rc[1])
  }

  return bio
}
