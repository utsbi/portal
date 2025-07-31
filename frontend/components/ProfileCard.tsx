import Image from "next/image";
import { FC } from "react";
import { IconHome } from "@tabler/icons-react";

interface ProfileCardProps {
  name: string;
  role: string;
  email: string;
}

const ProfileCard: FC<ProfileCardProps> = ({ name, role, email }) => {
  // Assumes images are in public/assets/images/people/ and named by first name (e.g., John.jpg)
  const firstName = name.split(" ")[0];
  const imagePath = `/assets/images/people/${firstName}.jpg`;

  return (
    <div className="overflow-hidden bg-white">
      <div className="aspect-[3/4] relative">
        <Image
          src={imagePath}
          alt={`Profile photo of ${name}`}
          className="object-cover w-full h-full"
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          priority
        />
      </div>
      <div className="p-4 text-center">
        <h3 className="text-xl">{name}</h3>
        <p className="text-muted-foreground text-base mb-3">{role}</p>
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 hover:bg-amber-200 transition-colors"
        >
          <IconHome className="w-4 h-4 text-amber-400 hover:text-amber-500 transition-colors" />
          <span className="sr-only">{`Email ${name}`}</span>
        </a>
      </div>
    </div>
  );
};

export default ProfileCard;
