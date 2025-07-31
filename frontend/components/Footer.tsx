const currentYear = new Date().getFullYear();
const socials = [
	{
		name: "Instagram",
		link: "https://instagram.com/ut.sbi",
	},
	{
		name: "LinkedIn",
		link: "https://linkedin.com/company/utsbi",
	},
	{
		name: "GitHub",
		link: "https://github.com/utsbi",
	},
];

function Footer() {
	return (
		<footer className="px-6 py-6 md:px-32 2xl:px-80 relative border-t border-gray-200 font-OldStandardTT">
			<div className="container mx-auto">
				<div className="flex flex-col md:flex-row justify-between items-center">
					<div className="text-center md:text-left mb-4 md:mb-0">
						<p className="text-sm text-gray-800">
							Research Driven, Professionally Inspired, and Student Powered
						</p>
						<p className="text-sm text-gray-800">
							&copy; {currentYear} Sustainable Building Initiative
						</p>
					</div>
					<div className="pl-3 flex space-x-4">
						{socials.map((social) => (
							<a
								key={social.name}
								href={social.link}
								aria-label={social.name}
								className="text-gray-800 hover:underline"
								target="_blank"
								rel="noopener noreferrer"
							>
								{social.name}
							</a>
						))}
					</div>
				</div>
			</div>
		</footer>
	);
}

export default Footer;
