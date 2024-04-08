export interface IUser {
	_id: string;
	username: string;
	password: string;
	email: string;
	image?: string;
};

export const UserValidator = {
	username: "string|min:3",
	password: "string|min:6",
	email: "string|min:4",
};

