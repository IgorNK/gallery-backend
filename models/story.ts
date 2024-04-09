export interface IStory {
	title: string;
	cover: string;
	info: string;
	body: string;
	tagList: string[];
	author: string;
	createdAt: Date;
	updatedAt: Date;
	slug: string;
};

export const StoryValidator = {
	title: "string|min:3",
	cover: "string|optional",
	info: "string|optional",
	body: "string|optional",
	tagList: "array|string|optional",
};
