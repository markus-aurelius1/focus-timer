/**
 * Tiny authoring helpers for the gazetteer.
 *
 *   P(kind, name, lat, lon, {
 *     id,      // slug override (default: slug(name))
 *     st,      // India: state id or ids (source → mouth for rivers)
 *     co,      // World: ISO3 country code(s)
 *     lvl,     // 1 core · 2 standard · 3 advanced (default 2)
 *     el,      // elevation in metres
 *     f,       // fact or facts
 *     aka, tags, sub, region,
 *     rel,     // relations; ids like 'river.ganga' resolve on the same sheet
 *     geom,    // linked sheet feature, e.g. 'river:ganga' (auto for rivers/lakes)
 *     line,    // rivers missing from Natural Earth: { trace: { from, to? } } or { course: [[lat,lon]…] }
 *   })
 *
 * Coordinates are decimal degrees, latitude first.
 */
export const P = (kind, name, lat, lon, o = {}) => ({ kind, name, lat, lon, ...o })
