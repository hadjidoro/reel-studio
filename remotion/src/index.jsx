/* Remotion entry for rendering: one composition, "Reel", whose length comes from the spec in its input props. */
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Reel, reelFrames } from './Reel.jsx';

const SAMPLE = {
  brand: { name: 'Acme', wordmark: ['AC', 'ME'], url: 'acme.com', colors: {} },
  spec: { scenes: [{ type: 'hook', title: 'Still looking for **a car?**' }] },
  zones: [], css: '', voTiming: null, assetMode: 'static',
};

const Root = () => <Composition id="Reel" component={Reel} width={1080} height={1920} fps={30} durationInFrames={90} defaultProps={SAMPLE}
  calculateMetadata={({ props }) => { const fps = props.fps || 30; return { fps, durationInFrames: reelFrames(props, fps) }; }} />;

registerRoot(Root);
