export interface IUser {
	username: string;
	password: string;
	email: string;
	image?: string | undefined | null;
	bio?: string | undefined | null;
	createdAt: Date;
	updatedAt: Date;
};

export const UserValidator = {
	username: "string|min:3|unique",
	password: "string|min:3",
	email: "email|min:3|unique",
	image: "string|optional",
	bio: "string|optional",
};

