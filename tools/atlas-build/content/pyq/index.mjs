/**
 * The PYQ ledger: one entry per previous-year question that names a place,
 * built with Q() from ../dsl.mjs. Split by exam; add a file and list it here.
 *
 * Rules
 * - Every entry cites where it was read: `source: { title, url }`, a web page
 *   or `pdf:<file>#p<page>` for a question paper.
 * - Record only what the source shows (exam, year, the question). Never fill
 *   years or appearances from memory.
 * - Name places by id (`in.lake.chilika`) or by name/alias; the build reports
 *   names it cannot match (add the place, or an `aka`) and ambiguous ones
 *   (use `{ name, kind, state }`).
 *
 * Sources supplied for this project (not yet transcribed — the cloud session
 * that set this up could not reach them):
 * - https://www.pmfias.com/category/prelims/protected-area-network/
 * - https://www.pmfias.com/category/upsc-cse-prelims-pyqs/prelims-pyqs-geography/prelims-pyqs-mapping/ (+ /page/N/)
 * - https://thedistrictminds.com/UPPSC_PYQs_Analysis_District_Minds.html
 * - https://superkalam.com/upsc-preparation/resources/upsc-map-based-pyqs-2015-2025-practice-map-questions
 */
import upscPrelims from './upsc-prelims.mjs'
import uppsc from './uppsc.mjs'

export default [...upscPrelims, ...uppsc]
