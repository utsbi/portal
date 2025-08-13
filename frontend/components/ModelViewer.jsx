"use client";

import "@google/model-viewer";
import { useState } from "react";

const defaultHotspots = [
	{
		slot: "hotspot-0",
		position: "-0.0569m 0.0969m -0.1398m",
		normal: "-0.5829775m 0.2863482m -0.7603565m",
		orbit: "-50.94862deg 84.56856deg 0.06545582m",
		target: "-0.04384604m 0.07348397m -0.1213202m",
		label: "The Fighters",
		description: "The Fighters are the main characters of the story.",
	},
	{
		slot: "hotspot-2",
		position: "0.0608m 0.0566m 0.0605m",
		normal: "0.2040984m 0.7985359m -0.56629m",
		orbit: "42.72974deg 84.74043deg 0.07104211m",
		target: "0.0757959m 0.04128428m 0.07109568m",
		label: "The Encounter",
	},
	{
		slot: "hotspot-7",
		position: "0.14598m 0.03177m -0.05945886m",
		normal: "-0.9392524m 0.2397608m -0.2456009m",
		orbit: "-142.3926deg 86.45934deg 0.06213665m",
		target: "0.1519967m 0.01904771m -0.05945886m",
		label: "Get Away!",
	},
	{
		slot: "hotspot-8",
		position: "0.0094m 0.0894m -0.15103m",
		normal: "-0.3878782m 0.4957891m -0.7770094m",
		orbit: "-118.6729deg 117.571deg 0.03905975m",
		target: "0.007600758m 0.06771782m -0.1386167m",
		label: "The Jump",
	},
	{
		slot: "hotspot-10",
		position: "0.02610224m 0.01458751m -0.004978945m",
		normal: "-0.602551m 0.7856147m -0.1405055m",
		orbit: "-78.89725deg 77.17752deg 0.08451112m",
		target: "0.02610223m 0.0145875m -0.004978945m",
		label: "Treasure",
	},
	{
		slot: "hotspot-11",
		position: "0.033838m 0.05610652m 0.1076345m",
		normal: "-0.624763m 0.5176854m 0.5845283m",
		orbit: "10.89188deg 119.9775deg 0.03543022m",
		target: "0.033838m 0.01610652m 0.1076345m",
		label: "Washing Machine ",
	},
];

const ModelViewer = ({
	modelSrc,
	skyboxImage,
	alt,
	style = { width: "100%", height: "400px" },
	// hotspots = defaultHotspots,
}) => {
	const [activeHotspot, setActiveHotspot] = useState(null);
	const [navHistory, setNavHistory] = useState([]);

	const handleHotspotClick = (e) => {
		const modelViewer = document.getElementById("model-viewer");
		if (!modelViewer) return;

		const dataset = e.target.dataset;
		const currentPosition = {
			orbit: modelViewer.cameraOrbit,
			target: modelViewer.cameraTarget,
			fieldOfView: modelViewer.fieldOfView,
		};

		// Save current position in history for back navigation
		setNavHistory([...navHistory, currentPosition]);

		// Set the active hotspot for description display
		setActiveHotspot(e.target.getAttribute("slot"));

		// Animate to the new position
		modelViewer.cameraTarget = dataset.target;
		modelViewer.cameraOrbit = dataset.orbit;
		modelViewer.fieldOfView = "45deg";

		modelViewer.setAttribute("camera-target", dataset.target);
		modelViewer.setAttribute("camera-orbit", dataset.orbit);
	};

	const handleGoBack = () => {
		if (navHistory.length === 0) return;

		const modelViewer = document.getElementById("model-viewer");
		if (!modelViewer) return;

		// Get the last position from history
		const lastPosition = navHistory[navHistory.length - 1];

		// Animate to the previous position
		modelViewer.cameraTarget = lastPosition.target;
		modelViewer.cameraOrbit = lastPosition.orbit;
		modelViewer.fieldOfView = lastPosition.fieldOfView;

		// Update history
		setNavHistory(navHistory.slice(0, -1));
		setActiveHotspot(null);
	};

	return (
		<div className="relative w-full rounded overflow-hidden">
			<model-viewer
				id="model-viewer"
				src={modelSrc}
				skybox-image={skyboxImage}
				skybox-height="0.06m"
				shadow-intensity="1"
				max-camera-orbit="auto 90deg auto"
				camera-controls
				touch-action="none"
				disable-pan
				ar-modes="webxr scene-viewer quick-look"
				tone-mapping="neutral"
				exposure="0.50"
				shadow-softness="1"
				environment-image="legacy"
				alt={alt}
				style={style}
				camera-orbit="0deg 75deg 2m"
				interpolation-decay="200"
			>
				{/* {hotspots.map((h, i) => (
          <button
            key={h.slot}
            className="absolute block max-w-32 w-max h-max px-[1em] pt-[0.6em] pb-[0.5em] pl-[1em] font-OldStandardTT font-bold text-[12px] break-words rounded bg-white text-black/80 shadow-md transform -translate-x-1/2 -translate-y-1/2 cursor-pointer pointer-events-auto focus:outline-none focus-visible:ring hover:bg-green-50 transition-colors"
            slot={h.slot}
            data-position={h.position}
            data-normal={h.normal}
            data-orbit={h.orbit}
            data-target={h.target}
            style={{ pointerEvents: "auto" }}
            onClick={handleHotspotClick}
          >
            {h.label}
          </button>
        ))} */}

				{/* Progress bar */}
				<div className="progress-bar hide" slot="progress-bar">
					<div className="update-bar"></div>
				</div>
			</model-viewer>

			{/* Tour navigation controls */}
			<div className="absolute bottom-4 left-0 right-0 flex justify-center items-center space-x-4 z-10 pointer-events-auto">
				{navHistory.length > 0 && (
					<button
						type="button"
						onClick={handleGoBack}
						className="bg-white px-4 pt-2 pb-1 rounded-full shadow-md text-black/80 cursor-pointer hover:bg-gray-100 transition-colors"
					>
						Back
					</button>
				)}

				{activeHotspot && (
					<div className="bg-white/90 px-6 py-3 rounded-lg shadow-lg max-w-md">
						<h3 className="font-bold mb-1">
							{hotspots.find((h) => h.slot === activeHotspot)?.label}
						</h3>
						<p>
							{hotspots.find((h) => h.slot === activeHotspot)?.description ||
								"Explore this area"}
						</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default ModelViewer;
