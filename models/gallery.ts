export interface IGallery {
	title: string;
	subtitle: string;
	cover: string;
	author: string;
	stories: string[];
	tagList: string[];
	createdAt: Date;
	updatedAt: Date;
	slug: string;
};

export const GalleryValidator = {
	title: "string|min:3",
	subtitle: "string|min:3|optional",
	cover: "string|min:3|optional",
	tagList: "array|string|optional",
};

