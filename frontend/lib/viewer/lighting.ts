/**
 * Lighting and exposure for the 3D project viewer.
 *
 * Colour pipeline: sRGB output with neutral tone mapping, so material
 * colours authored to match the reference renders come out as authored.
 *
 * Light: the sunrise sky is only the visible backdrop. As image-based light
 * its HDR sun turns every surface facing it yellow, so diffuse light and
 * reflections come from a neutral grey studio environment (three's
 * RoomEnvironment), plus a neutral hemisphere fill and a white key light for
 * form. Nothing casts shadows, so no extra render passes.
 *
 * Values were chosen by comparing the viewer against the project reference
 * renders from matching viewpoints.
 */

export interface ViewerLighting {
  /** renderer.toneMappingExposure */
  exposure: number;
  /** scene.environmentIntensity of the neutral studio environment. */
  environmentIntensity: number;
  /** scene.backgroundIntensity — brightness of the visible sky. */
  backgroundIntensity: number;
  /** Hemisphere light (white sky, warm-grey ground bounce). */
  fillIntensity: number;
  /** Directional light from the upper front-right, no shadows. */
  keyIntensity: number;
}

export const DEFAULT_LIGHTING: ViewerLighting = {
  exposure: 1,
  environmentIntensity: 0.7,
  backgroundIntensity: 1,
  fillIntensity: 1.1,
  keyIntensity: 1.5,
};

export const FILL_SKY_COLOR = "#ffffff";
export const FILL_GROUND_COLOR = "#a8a49c";
export const KEY_COLOR = "#ffffff";
/** Direction only (directional light aimed at the origin). */
export const KEY_POSITION: [number, number, number] = [0.6, 1, 0.45];
/**
 * Ground plane albedo. The plane used to be white, which the old linear
 * output showed as mid grey; with correct sRGB output white fills the frame
 * at full brightness and swallows light-coloured models. This grey renders
 * close to the plane's previous on-screen tone.
 */
export const GROUND_COLOR = "#8a8c8f";
/** Albedo for meshes exported without a material (clay look). */
export const CLAY_COLOR = "#dedbd5";

export function resolveLighting(
  overrides?: Partial<ViewerLighting>,
): ViewerLighting {
  return { ...DEFAULT_LIGHTING, ...overrides };
}
