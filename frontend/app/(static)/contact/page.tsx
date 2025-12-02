"use client" 
import { motion } from "framer-motion";
import { FormEvent } from "react";

// replace with SBI webhook
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1440160870431850641/5YWiI_vOx77_ENIse6_-QmRwRl8g12X-jlmaqOFSHWGInQOraGGexSmnvFTytqjeDeQo";

export default function Contact() {
	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		const form = e.currentTarget;
		const formData = new FormData(form);

		const name = formData.get("name");
		const email = formData.get("email");
		const message = formData.get("message");

		// send to Discord
		await fetch(DISCORD_WEBHOOK_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: `**New Contact Form Submission**  
				**Name:** ${name}  
				**Email:** ${email}  
				**Message:**  
				${message}`
			}),
		});

		alert("Message sent!");
		form.reset();
	};
	return (
		<section className="px-6 py-10 pt-36 md:px-32 2xl:px-80 relative font-OldStandardTT">
			
			<motion.div
			className="text-4xl mb-6"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.8, ease: "easeOut" }}
			>
			Contact Us
			</motion.div>

			<div className="max-w-4xl mx-auto">
    		<div className="border-2 border-gray-300 rounded-xl p-8 shadow-sm bg-white">
			<div className="text-xl mb-10">
				Have a question or want to collaborate with us on a project? Fill out
				the form below and we'll get back to you.
			</div>

			{/* TODO: Post to discord webhook*/}
			<div className="max-w-2xl mx-auto">
				<form onSubmit={handleSubmit}>
					<div className="flex flex-col md:flex-row gap-6 mb-6">
						<div className="form-group flex-1 w-full max-w-full">
							<label htmlFor="name" className="block text-lg mb-2 font-semibold">
								Name *
							</label>
							<input
								type="text"
								name="name"
								id="name"
								required
								className="w-full px-4 py-3 border-2 border-solid border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 box-border transition duration-200"
							/>
						</div>

						<div className="form-group flex-1 w-full max-w-full">
							<label htmlFor="email" className="block text-lg mb-2 font-semibold">
								Email *
							</label>
							<input
								type="email"
								name="email"
								id="email"
								required
								className="w-full px-4 py-3 border-2 border-solid border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 box-border transition duration-200"
							/>
						</div>
					</div>

					<div className="form-group w-full max-w-full">
						<label htmlFor="message" className="block text-lg mb-2 font-semibold">
							Message
						</label>
						<textarea
							name="message"
							id="message"
							rows={6}
							required
							className="w-full px-4 py-3 border-2 border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 box-border transition duration-200"
						></textarea>
					</div>

					<div className="flex justify-start mt-6">
						<button
							type="submit"
							className="bg-green-500 hover:bg-green-600 text-white transition duration-300 pt-3 pb-2 px-6 border border-green-500 hover:border-green-500 rounded"
						>
							Send Message
						</button>
					</div>
				</form>
				</div>
				</div>
				<div className="mt-6 text-xl">
					<div>Prefer to reach out directly?</div>
					<div>
						Contact our presidents: {" "}
						<a
							href="mailto:pedro@utsbi.org"
							className="text-green-500 hover:underline font-semibold"
						>
							Pedro Guzman
						</a>{" "}
						or {" "}
						<a
							href="mailto:sam@utsbi.org"
							className="text-green-500 hover:underline font-semibold"
						>
							Sam Moran
						</a>
					</div>
				</div>
			</div>
		</section>
	);
}
