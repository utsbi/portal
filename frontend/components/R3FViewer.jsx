"use client";

import {
	CameraControls,
	ContactShadows,
	PerspectiveCamera,
	useEnvironment,
	useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";

const MODEL = "/models/family_home.glb";
const HDRI = "/models/spruit_sunrise_4k.jpg";

// Camera controller component to handle camera switching
const CameraSelector = ({ activeCameraIndex, houseRef, cameraControlsRef }) => {
	const { camera } = useThree();

	useEffect(() => {
		if (houseRef?.current && activeCameraIndex >= 0) {
			// Find all PerspectiveCamera children in the house group
			const camerasArray = [];
			houseRef.current.traverse((object) => {
				if (object.type === "PerspectiveCamera") {
					camerasArray.push(object);
				}
			});

			// Now use our target camera based on the index
			const cameraToUse = camerasArray[activeCameraIndex];

			if (cameraToUse) {
				// If we have camera controls, use them to smoothly transition
				if (cameraControlsRef?.current) {
					// Extract position and target from the camera
					const position = cameraToUse.position.clone();

					// Calculate a target point in front of the camera
					const direction = new THREE.Vector3(0, 0, -1);
					direction.applyQuaternion(cameraToUse.quaternion);
					const target = position.clone().add(direction.multiplyScalar(10));

					// Move the camera controls to match the perspective camera
					cameraControlsRef.current.setLookAt(
						position.x,
						position.y,
						position.z,
						target.x,
						target.y,
						target.z,
						true,
					);
				} else {
					// Direct camera manipulation if no controls available
					camera.position.copy(cameraToUse.position);
					camera.rotation.copy(cameraToUse.rotation);
					camera.updateProjectionMatrix();
				}
			}
		}
	}, [activeCameraIndex, camera, houseRef, cameraControlsRef]);

	return null;
};

// Camera debug info component that runs inside the Canvas
const CameraDebugInfo = ({ onCameraUpdate }) => {
	const { camera } = useThree();

	useFrame(() => {
		// Update camera info every frame and send it to parent component
		const position = {
			x: parseFloat(camera.position.x.toFixed(3)),
			y: parseFloat(camera.position.y.toFixed(3)),
			z: parseFloat(camera.position.z.toFixed(3)),
		};
		const rotation = {
			x: parseFloat(camera.rotation.x.toFixed(3)),
			y: parseFloat(camera.rotation.y.toFixed(3)),
			z: parseFloat(camera.rotation.z.toFixed(3)),
		};

		onCameraUpdate({ position, rotation });
	});

	return null;
};

// Custom environment component to use HDR as background
const SceneEnvironment = ({ path }) => {
	const envMap = useEnvironment({ files: path });
	const { scene } = useThree();

	useEffect(() => {
		if (envMap) {
			// Set the environment map as the scene background
			scene.background = envMap;
			scene.environment = envMap;

			// Adjust the environment rotation to match the ground plane
			// This helps align the horizon with the ground plane
			envMap.rotation = Math.PI / 2;
		}

		return () => {
			// Cleanup
			if (scene.background === envMap) {
				scene.background = null;
			}
			if (scene.environment === envMap) {
				scene.environment = null;
			}
		};
	}, [envMap, scene]);

	return null;
};

// Camera constraint component to prevent going below ground level
const CameraConstraints = ({ minHeight = 5, cameraControlsRef }) => {
	const { camera } = useThree();

	useFrame(() => {
		// Check if camera is below minimum height and adjust if needed
		if (camera.position.y < minHeight) {
			camera.position.y = minHeight;

			// If using camera controls, update them too
			if (cameraControlsRef?.current) {
				cameraControlsRef.current.update();
			}
		}
	});

	return null;
};

// Model optimizer component to prevent disappearing at distance
const ModelOptimizer = ({ houseRef }) => {
	useEffect(() => {
		if (houseRef?.current) {
			// Traverse the model and disable frustum culling on all meshes
			houseRef.current.traverse((object) => {
				if (object.isMesh) {
					// Disable frustum culling on all meshes
					object.frustumCulled = false;

					// Also ensure the material is properly configured for distant viewing
					if (object.material) {
						// Ensure the material renders correctly at distance
						object.material.needsUpdate = true;
						object.material.side = THREE.DoubleSide; // Render both sides

						// If it's a custom material that might have transparency issues
						if (object.material.transparent) {
							object.material.alphaTest = 0.01;
							object.material.depthWrite = true;
						}
					}
				}
			});
		}
	}, [houseRef]);

	return null;
};

// Ground plane component to create a realistic ground effect
const Ground = () => {
	return (
		<mesh
			rotation={[-Math.PI / 2, 0, 0]}
			position={[0, -0.01, 0]}
			receiveShadow
		>
			<planeGeometry args={[15000, 10000]} />
			<meshStandardMaterial
				color="#ffffff"
				roughness={0.8}
				metalness={0.2}
				envMapIntensity={0.2}
				// Make the ground slightly transparent where it meets the skybox horizon
				transparent={true}
				opacity={0.9}
			/>
		</mesh>
	);
};

function House(props) {
	const { nodes, materials } = useGLTF(MODEL);

	const group = useRef();
	// Pass reference to parent component
	useEffect(() => {
		if (props.setHouseRef) {
			props.setHouseRef(group);
		}
	}, [props.setHouseRef]);

	return (
		<group {...props} position={[0, 0, 0]} ref={group} dispose={null}>
			<PerspectiveCamera
				makeDefault={false}
				far={100}
				near={0.01}
				fov={50}
				position={[35.85, 56.633, 95.632]}
				rotation={[-0.422, -0.708, -0.284]}
			/>
			<PerspectiveCamera
				makeDefault={false}
				far={100}
				near={0.01}
				fov={50}
				position={[212.529, 68.041, 143.939]}
				rotation={[-0.233, 0.564, 0.126]}
			/>
			<PerspectiveCamera
				makeDefault={false}
				far={100}
				near={0.01}
				fov={50}
				position={[225.095, 84.115, 1.407]}
				rotation={[-2.683, 0.627, 2.86]}
			/>
			<PerspectiveCamera
				makeDefault={false}
				far={100}
				near={0.01}
				fov={50}
				position={[271.882, 90, 270.346]}
				rotation={[-0.807, -0.547, -0.497]}
			/>
			<PerspectiveCamera
				makeDefault={false}
				far={100}
				near={0.01}
				fov={50}
				position={[434.819, 61.22, 198.335]}
				rotation={[-2.481, -0.573, -2.743]}
			/>
			<PerspectiveCamera
				makeDefault={false}
				far={100}
				near={0.01}
				fov={50}
				position={[-95.626, 48.542, -7.707]}
				rotation={[-2.724, 0.739, 2.851]}
			/>
			<PerspectiveCamera
				makeDefault={false}
				far={100}
				near={0.01}
				fov={50}
				position={[-280, 50, -304.497]}
				rotation={[-3, 0.3, 3]}
			/>
			<PerspectiveCamera
				makeDefault={false}
				far={100}
				near={0.01}
				fov={50}
				position={[19.898, 68.4, 141.497]}
				rotation={[-2.463, 0.918, 2.572]}
			/>
			<mesh
				geometry={
					nodes["0000-0000_HOUSE_ASSEMBLY0000-0001_FOUNDATION"].geometry
				}
				material={materials.CONCRETE}
				rotation={[Math.PI / 2, 0, 0]}
			/>
		</group>
	);
}

useGLTF.preload(MODEL);

export default function TestViewer() {
	const cameraControlsRef = useRef();
	const [houseRef, setHouseRef] = useState(null);
	const [activeCameraIndex, setActiveCameraIndex] = useState(-1);
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [cameraInfo, setCameraInfo] = useState({
		position: { x: 0, y: 0, z: 0 },
		rotation: { x: 0, y: 0, z: 0 },
	});

	// Camera view options
	const cameraViews = [
		{ id: 0, label: "Living Room 1" },
		{ id: 1, label: "Living Room 2" },
		{ id: 2, label: "Living Room 3" },
		{ id: 3, label: "Bedroom 1" },
		{ id: 4, label: "Bedroom 2" },
		{ id: 5, label: "Theater Room" },
		{ id: 6, label: "Garage" },
		{ id: 7, label: "Office" },
	];

	// Define camera presets
	const cameraPresets = [
		// {
		//   id: "front",
		//   label: "Front View",
		//   position: [50, 50, 100],
		//   target: [0, 0, 0],
		// },
		// {
		//   id: "overhead",
		//   label: "Top View",
		//   position: [0, 1180, 118],
		//   target: [0, 0, 0],
		// },
		// {
		//   id: "side",
		//   label: "Side View",
		//   position: [100, 50, 0],
		//   target: [0, 0, 0],
		// },1
		{
			id: "reset",
			label: "Reset",
			position: [6.5, 615, 1015],
			target: [0, 0, 0],
		},
	];

	// Function to handle preset camera positions
	const handleCameraPreset = (preset) => {
		// Reset active camera index when using a preset
		setActiveCameraIndex(-1);

		if (!cameraControlsRef.current) return;

		const selectedPreset = cameraPresets.find((p) => p.id === preset);
		if (selectedPreset) {
			const { position, target } = selectedPreset;
			cameraControlsRef.current.setLookAt(
				position[0],
				position[1],
				position[2],
				target[0],
				target[1],
				target[2],
				true,
			);
		}
	};

	// Function to handle camera view selection
	const handleCameraViewSelect = (index) => {
		setActiveCameraIndex(index);
		setDropdownOpen(false);
	};

	return (
		<div className="w-full h-[500px] relative rounded overflow-hidden">
			{/* Camera view dropdown */}
			<div className="absolute bottom-2.5 left-2.5 z-10">
				<div className="relative">
					<button
						type="button"
						className="px-3 pt-2 pb-1 rounded border-none cursor-pointer bg-white bg-opacity-80 hover:bg-opacity-100 transition-opacity"
						onClick={() => setDropdownOpen(!dropdownOpen)}
					>
						{activeCameraIndex >= 0
							? cameraViews[activeCameraIndex].label
							: "Select Camera View"}
					</button>

					{dropdownOpen && (
						<div className="absolute bottom-full left-0 bg-white rounded p-1.5 mb-1.5 w-40 max-h-[300px] overflow-y-auto shadow-lg bg-opacity-90">
							{cameraViews.map((view) => (
								<button
									type="button"
									key={view.id}
									className={`w-full text-left py-1.5 px-2.5 cursor-pointer rounded hover:bg-gray-100 ${
										activeCameraIndex === view.id ? "bg-gray-200" : ""
									}`}
									onClick={() => handleCameraViewSelect(view.id)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											handleCameraViewSelect(view.id);
										}
									}}
								>
									{view.label}
								</button>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Camera control buttons */}
			<div className="absolute bottom-2.5 right-2.5 z-10 flex gap-1.5">
				{cameraPresets.map((preset) => (
					<button
						type="button"
						className="px-3 pt-2 pb-1 rounded border-none cursor-pointer bg-white bg-opacity-80 hover:bg-opacity-100 transition-opacity"
						key={preset.id}
						onClick={() => handleCameraPreset(preset.id)}
					>
						{preset.label}
					</button>
				))}
			</div>

			<Canvas
				pixelratio={[1, 2]}
				camera={{
					position: [6.319, 614.043, 1012.865],
					rotation: [0, 0, 0],
					fov: 50,
					// Increase near and far planes for better rendering at all distances
					near: 0.1,
					far: 10000,
				}}
				// Use linear color space for more accurate HDR rendering
				linear
				// Set depth buffer precision to prevent z-fighting when zoomed out
				gl={{
					antialias: true,
					logarithmicDepthBuffer: true,
					// Increase precision to prevent depth buffer issues
					depth: true,
					stencil: false,
				}}
				// Disable frustum culling to prevent objects from disappearing
				frameloop="always"
				// Ensure performance with adaptive performance mode
				performance={{ min: 0.5 }}
			>
				<ambientLight intensity={0.3} />
				<spotLight
					intensity={0.3}
					angle={0.1}
					penumbra={1}
					position={[5, 25, 20]}
				/>
				<Suspense fallback={null}>
					<House setHouseRef={setHouseRef} />
					{activeCameraIndex >= 0 && houseRef && (
						<CameraSelector
							activeCameraIndex={activeCameraIndex}
							houseRef={houseRef}
							cameraControlsRef={cameraControlsRef}
						/>
					)}
					<SceneEnvironment path={HDRI} />
					<ContactShadows
						rotation-x={Math.PI / 2}
						position={[0, -0.8, 0]}
						opacity={1}
					/>
					<Ground />
					<CameraControls
						ref={cameraControlsRef}
						minDistance={1}
						maxDistance={3000}
						dollySpeed={0.5}
						truckSpeed={0.5}
						verticalDragToForward={false}
						infinityDolly={false}
						minPolarAngle={0}
						maxPolarAngle={Math.PI / 2.05} // Restricting to just above ground level
						// Camera bounds to prevent going too far from the model
						boundaryEnclosesCamera={true}
						azimuthRotateSpeed={0.5}
						polarRotateSpeed={0.5}
						smoothTime={0.4}
					/>
					<CameraConstraints
						minHeight={5}
						cameraControlsRef={cameraControlsRef}
					/>
					<CameraDebugInfo onCameraUpdate={setCameraInfo} />
					{houseRef && <ModelOptimizer houseRef={houseRef} />}
				</Suspense>
			</Canvas>

			{/* Camera debug overlay - outside the canvas to display in DOM */}
			{/* <div className="absolute top-2.5 left-2.5 z-10 bg-black bg-opacity-70 text-white p-2 rounded font-mono text-sm">
				<div className="mb-1">
					<strong className="text-green-400">Position:</strong>{" "}
					<span className="text-yellow-300">
						[{cameraInfo.position.x}, {cameraInfo.position.y},{" "}
						{cameraInfo.position.z}]
					</span>
				</div>
				<div>
					<strong className="text-green-400">Rotation:</strong>{" "}
					<span className="text-yellow-300">
						[{cameraInfo.rotation.x}, {cameraInfo.rotation.y},{" "}
						{cameraInfo.rotation.z}]
					</span>
				</div>
			</div> */}
		</div>
	);
}
