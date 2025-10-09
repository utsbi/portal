"use client";

import {
	CameraControls,
	ContactShadows,
	PerspectiveCamera,
	useEnvironment,
	useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React, { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";

const MODEL = "/models/family_home.glb";
const HDRI = "/models/spruit_sunrise_4k.jpg";

// TypeScript interfaces
interface CameraSelectorProps {
	activeCameraIndex: number;
	houseRef: React.RefObject<THREE.Group | null> | null;
	cameraControlsRef: React.RefObject<any>;
}

interface CameraDebugInfoProps {
	onCameraUpdate: (info: CameraInfo) => void;
}

interface CameraInfo {
	position: { x: number; y: number; z: number };
	rotation: { x: number; y: number; z: number };
}

interface SceneEnvironmentProps {
	path: string;
}

interface CameraConstraintsProps {
	minHeight?: number;
	cameraControlsRef: React.RefObject<any>;
}

interface ModelOptimizerProps {
	houseRef: React.RefObject<THREE.Group | null> | null;
}

interface HouseProps {
	setHouseRef?: (ref: React.RefObject<THREE.Group | null>) => void;
}

interface CameraView {
	id: number;
	label: string;
}

interface CameraPreset {
	id: string;
	label: string;
	position: [number, number, number];
	target: [number, number, number];
}

// Camera controller component to handle camera switching
const CameraSelector: React.FC<CameraSelectorProps> = ({
	activeCameraIndex,
	houseRef,
	cameraControlsRef,
}) => {
	const { camera } = useThree();

	useEffect(() => {
		if (houseRef?.current && activeCameraIndex >= 0) {
			// Find all PerspectiveCamera children in the house group
			const camerasArray: THREE.PerspectiveCamera[] = [];
			houseRef.current.traverse((object) => {
				if (object.type === "PerspectiveCamera") {
					camerasArray.push(object as THREE.PerspectiveCamera);
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
const CameraDebugInfo: React.FC<CameraDebugInfoProps> = ({
	onCameraUpdate,
}) => {
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
const SceneEnvironment: React.FC<SceneEnvironmentProps> = ({ path }) => {
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
const CameraConstraints: React.FC<CameraConstraintsProps> = ({
	minHeight = 5,
	cameraControlsRef,
}) => {
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
const ModelOptimizer: React.FC<ModelOptimizerProps> = ({ houseRef }) => {
	useEffect(() => {
		if (houseRef?.current) {
			// Traverse the model and disable frustum culling on all meshes
			houseRef.current.traverse((object) => {
				if (object.type === "Mesh") {
					const mesh = object as THREE.Mesh;
					// Disable frustum culling on all meshes
					mesh.frustumCulled = false;

					// Also ensure the material is properly configured for distant viewing
					if (mesh.material) {
						const material = mesh.material as THREE.Material;
						// Ensure the material renders correctly at distance
						material.needsUpdate = true;
						if ("side" in material) {
							(material as any).side = THREE.DoubleSide; // Render both sides
						}

						// If it's a custom material that might have transparency issues
						if ("transparent" in material && material.transparent) {
							if ("alphaTest" in material) (material as any).alphaTest = 0.01;
							if ("depthWrite" in material) (material as any).depthWrite = true;
						}
					}
				}
			});
		}
	}, [houseRef]);

	return null;
};

// Ground plane component to create a realistic ground effect
const Ground: React.FC = () => {
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

const House: React.FC<HouseProps> = (props) => {
	const { nodes, materials } = useGLTF(MODEL) as any;

	const group = useRef<THREE.Group>(null);
	// Pass reference to parent component
	useEffect(() => {
		if (props.setHouseRef && group.current) {
			props.setHouseRef(group);
		}
	}, [props]);

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
};

const TestViewer: React.FC = () => {
	// Preload the model on component mount instead of at module level
	React.useEffect(() => {
		useGLTF.preload(MODEL);
	}, []);
	const cameraControlsRef = useRef<any>(null);
	const [houseRef, setHouseRef] =
		useState<React.MutableRefObject<THREE.Group | null> | null>(null);
	const [activeCameraIndex, setActiveCameraIndex] = useState<number>(-1);
	const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
	const [cameraInfo, setCameraInfo] = useState<CameraInfo>({
		position: { x: 0, y: 0, z: 0 },
		rotation: { x: 0, y: 0, z: 0 },
	});

	// Camera view options
	const cameraViews: CameraView[] = [
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
	const cameraPresets: CameraPreset[] = [
		{
			id: "reset",
			label: "Reset",
			position: [6.5, 615, 1015],
			target: [0, 0, 0],
		},
	];

	// Function to handle preset camera positions
	const handleCameraPreset = (preset: string) => {
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
	const handleCameraViewSelect = (index: number) => {
		setActiveCameraIndex(index);
		setDropdownOpen(false);
	};

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Element;
			if (!target.closest(".camera-dropdown")) {
				setDropdownOpen(false);
			}
		};

		if (dropdownOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [dropdownOpen]);

	return (
		<div className="w-full h-[500px] relative rounded-lg overflow-hidden shadow-lg">
			{/* Camera view dropdown */}
			<div className="absolute bottom-4 left-4 z-20 camera-dropdown">
				<div className="relative">
					<button
						type="button"
						className="inline-flex items-center justify-between min-w-[160px] px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
						onClick={() => setDropdownOpen(!dropdownOpen)}
						aria-expanded={dropdownOpen}
						aria-haspopup="true"
					>
						<span className="truncate">
							{activeCameraIndex >= 0
								? cameraViews[activeCameraIndex].label
								: "Select Camera View"}
						</span>
						<svg
							className={`ml-2 h-4 w-4 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>

					{dropdownOpen && (
						<div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-30 max-h-80 overflow-y-auto">
							<div className="py-1">
								{cameraViews.map((view) => (
									<button
										type="button"
										key={view.id}
										className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors duration-150 ${
											activeCameraIndex === view.id
												? "bg-indigo-50 text-indigo-900 font-medium"
												: "text-gray-700"
										}`}
										onClick={() => handleCameraViewSelect(view.id)}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												handleCameraViewSelect(view.id);
											}
										}}
									>
										{view.label}
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Camera control buttons */}
			<div className="absolute bottom-4 right-4 z-20 flex gap-2">
				{cameraPresets.map((preset) => (
					<button
						type="button"
						className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
						key={preset.id}
						onClick={() => handleCameraPreset(preset.id)}
					>
						{preset.label}
					</button>
				))}
			</div>

			<Canvas
				dpr={[1, 2]}
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
			{/* <div className="absolute top-4 left-4 z-20 bg-black bg-opacity-80 text-white p-3 rounded-md font-mono text-xs backdrop-blur-sm">
				<div className="mb-1">
					<span className="text-green-400 font-semibold">Position:</span>{" "}
					<span className="text-yellow-300">
						[{cameraInfo.position.x}, {cameraInfo.position.y},{" "}
						{cameraInfo.position.z}]
					</span>
				</div>
				<div>
					<span className="text-green-400 font-semibold">Rotation:</span>{" "}
					<span className="text-yellow-300">
						[{cameraInfo.rotation.x}, {cameraInfo.rotation.y},{" "}
						{cameraInfo.rotation.z}]
					</span>
				</div>
			</div> */}
		</div>
	);
};

export default TestViewer;
