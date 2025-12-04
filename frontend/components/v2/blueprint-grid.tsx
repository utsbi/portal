// Blueprint grid pattern for architectural aesthetic
export function BlueprintGrid() {
	return (
		<div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
			<svg
				width="100%"
				height="100%"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				<title>Blueprint grid pattern</title>
				<defs>
					<pattern
						id="blueprint-grid"
						width="50"
						height="50"
						patternUnits="userSpaceOnUse"
					>
						<path
							d="M 50 0 L 0 0 0 50"
							fill="none"
							stroke="currentColor"
							strokeWidth="0.5"
						/>
					</pattern>
					<pattern
						id="blueprint-grid-large"
						width="250"
						height="250"
						patternUnits="userSpaceOnUse"
					>
						<path
							d="M 250 0 L 0 0 0 250"
							fill="none"
							stroke="currentColor"
							strokeWidth="1"
						/>
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#blueprint-grid)" />
				<rect width="100%" height="100%" fill="url(#blueprint-grid-large)" />
			</svg>
		</div>
	);
}
