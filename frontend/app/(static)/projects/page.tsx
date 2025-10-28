import type { Metadata } from "next";
import AccordionProjects from "@/components/AccordionProjects";

export const metadata: Metadata = {
	title: "Projects",
	description: "Overview of infrastructure projects that we have worked on.",
};

export default function Projects() {
	return (
		<section className="px-6 py-10 pt-36 md:px-32 2xl:px-80 relative font-OldStandardTT">
			<div className="text-4xl">Projects</div>
			<div className="text-3xl py-6">Infrastructure Projects</div>
			<div>
				<AccordionProjects />
			</div>
		</section>
	);
}
