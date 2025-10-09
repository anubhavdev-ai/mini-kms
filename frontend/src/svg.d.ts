// svg.d.ts
declare module "*.svg" {
    import * as React from "react";
  
    // For React components (when using something like @svgr/webpack)
    export const ReactComponent: React.FunctionComponent<
      React.SVGProps<SVGSVGElement> & { title?: string }
    >;
  
    // For importing as a source path (string)
    const src: string;
    export default src;
  }
  