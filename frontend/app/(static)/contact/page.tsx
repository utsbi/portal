import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Contact Us",
};

export default function Contact() {
	return (
		<section className="px-6 py-10 pt-36 md:px-32 2xl:px-80 relative font-OldStandardTT">
			<div className="text-4xl mb-6">Contact Us</div>
			<div className="text-xl mb-10">
				Have a question or want to collaborate with us on a project? Fill out
				the form below and we'll get back to you.
			</div>

			{/* TODO: Post to discord webhook*/}
			<div className="max-w-2xl mx-auto">
				<form name="contact" method="POST" data-netlify="true">
					<div className="flex flex-col md:flex-row gap-6 mb-6">
						<div className="form-group flex-1 w-full max-w-full">
							<label htmlFor="name" className="block text-lg mb-2">
								Name
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
							<label htmlFor="email" className="block text-lg mb-2">
								Email
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
						<label htmlFor="message" className="block text-lg mb-2">
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
				<div className="mt-6 text-xl">
					<div>Prefer to reach out directly?</div>
					<div>
						Contact our presidents:{" "}
						<a
							href="mailto:pedro@utsbi.org"
							className="text-green-500 hover:underline font-semibold"
						>
							Pedro Guzman
						</a>{" "}
						or{" "}
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
