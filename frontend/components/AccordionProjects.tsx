import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import classNames from "classnames";
import Image from "next/image";
import React from "react";
import ModelViewer from "./ModelViewer.jsx";
import TestViewer from "./R3FViewer.jsx";
import "./styles.css";

// TypeScript interfaces
interface AccordionTriggerProps {
	children: React.ReactNode;
	className?: string;
}

interface AccordionContentProps {
	children: React.ReactNode;
	className?: string;
}

// TODO: Refactor to use a loop to import images

// EXTERIOR VIEW
import ex1 from "@/assets/images/project-one/exterior-concept/EXTERIOR-1.webp";
import ex2 from "@/assets/images/project-one/exterior-concept/EXTERIOR-2.webp";
// INTERIOR VIEW
import in1 from "@/assets/images/project-one/interior-concept/INTERIOR-1.webp";
import in2 from "@/assets/images/project-one/interior-concept/INTERIOR-2.webp";
import in3 from "@/assets/images/project-one/interior-concept/INTERIOR-3.webp";
import in4 from "@/assets/images/project-one/interior-concept/INTERIOR-4.webp";
// SITE VIEW
import site1 from "@/assets/images/project-one/site-view/SITE-1.webp";
import site2 from "@/assets/images/project-one/site-view/SITE-2.webp";
import site3 from "@/assets/images/project-one/site-view/SITE-3.webp";
import site4 from "@/assets/images/project-one/site-view/SITE-4.webp";
import pe1 from "@/assets/images/project-two/exterior-concept/1.webp";
import pe2 from "@/assets/images/project-two/exterior-concept/2.webp";
import pe3 from "@/assets/images/project-two/exterior-concept/3.webp";
import pe4 from "@/assets/images/project-two/exterior-concept/4.webp";
import pi1 from "@/assets/images/project-two/interior-concept/1.webp";
import pi2 from "@/assets/images/project-two/interior-concept/2.webp";
import pi3 from "@/assets/images/project-two/interior-concept/3.webp";
import pi4 from "@/assets/images/project-two/interior-concept/4.webp";

const AccordionProjects: React.FC = () => (
	<Accordion.Root
		className="AccordionRoot"
		type="single"
		defaultValue="item-2"
		collapsible
	>
		<Accordion.Item className="AccordionItem" value="item-2">
			<AccordionTrigger className="text-xl">
				Sustainable Family Home Project
			</AccordionTrigger>
			<AccordionContent>
				{/* // description */}
				<div className="py-4">
					<Accordion.Root className="AccordionRoot" type="multiple">
						<Accordion.Item className="AccordionItem" value="item-1">
							<AccordionTrigger>Exterior Concept Images</AccordionTrigger>
							<AccordionContent>
								<div className="flex flex-col md:flex-row flex-wrap">
									<div className="flex-1 basis-1/2">
										<Image
											src={pe1.src}
											alt="Exterior Concept 1"
											className="w-full"
											width={pe1.width}
											height={pe1.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={pe2.src}
											alt="Exterior Concept 2"
											className="w-full"
											width={pe2.width}
											height={pe2.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={pe3.src}
											alt="Exterior Concept 3"
											className="w-full"
											width={pe3.width}
											height={pe3.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={pe4.src}
											alt="Exterior Concept 4"
											className="w-full"
											width={pe4.width}
											height={pe4.height}
										/>
									</div>
								</div>
							</AccordionContent>
						</Accordion.Item>
						<Accordion.Item className="AccordionItem" value="item-2">
							<AccordionTrigger>Interior Concept Images</AccordionTrigger>
							<AccordionContent>
								<div className="flex flex-col md:flex-row flex-wrap">
									<div className="flex-1 basis-1/2">
										<Image
											src={pi1.src}
											alt="Interior Concept 1"
											className="w-full"
											width={pi1.width}
											height={pi1.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={pi2.src}
											alt="Interior Concept 2"
											className="w-full"
											width={pi2.width}
											height={pi2.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={pi3.src}
											alt="Interior Concept 3"
											className="w-full"
											width={pi3.width}
											height={pi3.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={pi4.src}
											alt="Interior Concept 4"
											className="w-full"
											width={pi4.width}
											height={pi4.height}
										/>
									</div>
								</div>
							</AccordionContent>
						</Accordion.Item>
					</Accordion.Root>
				</div>
				<div className="flex flex-col items-center">
					<TestViewer />
				</div>
				{/* <div className="italic text-center pt-4">// caption</div> */}
			</AccordionContent>
		</Accordion.Item>
		<Accordion.Item className="AccordionItem" value="item-1">
			<AccordionTrigger className="text-xl">
				Hobbie Farm Project
			</AccordionTrigger>
			<AccordionContent>
				A small, space-efficient housing concept designed as a foundation for
				sustainable living. This prototype serves as a starting point, with
				plans to integrate eco-friendly features and innovations during the
				building process.
				<div className="py-4">
					<Accordion.Root className="AccordionRoot" type="multiple">
						<Accordion.Item className="AccordionItem" value="item-1">
							<AccordionTrigger>Site View Images</AccordionTrigger>
							<AccordionContent>
								<div className="flex flex-col md:flex-row flex-wrap">
									<div className="flex-1 basis-1/2">
										<Image
											src={site1.src}
											alt="Site View 1"
											className="w-full"
											width={site1.width}
											height={site1.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={site2.src}
											alt="Site View 2"
											className="w-full"
											width={site2.width}
											height={site2.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={site3.src}
											alt="Site View 3"
											className="w-full"
											width={site3.width}
											height={site3.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={site4.src}
											alt="Site View 4"
											className="w-full"
											width={site4.width}
											height={site4.height}
										/>
									</div>
								</div>
							</AccordionContent>
						</Accordion.Item>
						<Accordion.Item className="AccordionItem" value="item-2">
							<AccordionTrigger>Exterior Concept Images</AccordionTrigger>
							<AccordionContent>
								<div className="flex flex-col md:flex-row">
									<div className="flex-1 basis-1/2">
										<Image
											src={ex1.src}
											alt="Exterior Concept 1"
											className="w-full"
											width={ex1.width}
											height={ex1.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={ex2.src}
											alt="Exterior Concept 2"
											className="w-full"
											width={ex2.width}
											height={ex2.height}
										/>
									</div>
								</div>
							</AccordionContent>
						</Accordion.Item>
						<Accordion.Item className="AccordionItem" value="item-3">
							<AccordionTrigger>Interior Concept Images</AccordionTrigger>
							<AccordionContent>
								<div className="flex flex-col md:flex-row flex-wrap">
									<div className="flex-1 basis-1/2">
										<Image
											src={in1.src}
											alt="Interior Concept 1"
											className="w-full"
											width={in1.width}
											height={in1.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={in2.src}
											alt="Interior Concept 2"
											className="w-full"
											width={in2.width}
											height={in2.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={in3.src}
											alt="Interior Concept 3"
											className="w-full"
											width={in3.width}
											height={in3.height}
										/>
									</div>
									<div className="flex-1 basis-1/2">
										<Image
											src={in4.src}
											alt="Interior Concept 4"
											className="w-full"
											width={in4.width}
											height={in4.height}
										/>
									</div>
								</div>
							</AccordionContent>
						</Accordion.Item>
					</Accordion.Root>
				</div>
				<div className="flex flex-col items-center">
					<ModelViewer
						modelSrc="/models/hobbie_farm.glb"
						skyboxImage="/models/spruit_sunrise_4k.jpg"
						alt="A 3D model of a storage-unit-sized housing prototype"
					/>
				</div>
				<div className="italic text-center pt-4">
					A 3D-rendered model of a storage-unit-sized housing prototype, created
					to optimize space efficiency and a framework to integrate sustainable
					technologies
				</div>
			</AccordionContent>
		</Accordion.Item>
	</Accordion.Root>
);

const AccordionTrigger = React.forwardRef<
	React.ComponentRef<typeof Accordion.Trigger>,
	AccordionTriggerProps
>(({ children, className, ...props }, forwardedRef) => (
	<Accordion.Header className="AccordionHeader">
		<Accordion.Trigger
			className={classNames("AccordionTrigger", className)}
			{...props}
			ref={forwardedRef}
		>
			{children}
			<ChevronDownIcon
				className="AccordionChevron text-green-700"
				aria-hidden
			/>
		</Accordion.Trigger>
	</Accordion.Header>
));

AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef<
	React.ComponentRef<typeof Accordion.Content>,
	AccordionContentProps
>(({ children, className, ...props }, forwardedRef) => (
	<Accordion.Content
		className={classNames("AccordionContent", className)}
		{...props}
		ref={forwardedRef}
	>
		<div className="AccordionContentText">{children}</div>
	</Accordion.Content>
));

AccordionContent.displayName = "AccordionContent";

export default AccordionProjects;
