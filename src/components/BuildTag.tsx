export const BUILD_ID = __TG_DRIVE_BUILD__;

/** Tiny build marker so we can tell which deployment a browser is running. */
const BuildTag = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none fixed bottom-1 left-2 z-[60] select-none text-[10px] text-muted-foreground/60"
  >
    build {BUILD_ID}
  </div>
);

export default BuildTag;
