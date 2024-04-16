import type { ServiceSchema, ServiceSettingSchema, Service, Context } from 'moleculer';
import { Errors } from 'moleculer';
import ApiGateway from 'moleculer-web';
import type { Meta } from '../types';
import DbService from '../mixins/db.mixin';
import { StoryValidator, type IStory } from '../models/story';
import { type IUser } from '../models/user';
import slug from 'slug';
import sanitizeHtml from 'sanitize-html';

export interface ActionCreateParams {
	story: {
		title: string,
		body?: string,
		info?: string,
		cover?: string,
		tagList?: string[],
	},
}

export interface ActionUpdateParams {
	id: string,
	story: {
		title?: string,
		body?: string,
		info?: string,
		cover?: string,
		tagList?: string[],
	}
}

export interface ActionListParams {
	id?: string | string[],
	tag?: string,
	author?: string,
	limit?: number,
	offset?: number,
}

export interface ActionGetParams {
	id: string | string[],
}

export interface ActionDeleteParams {
	id: string,
}

interface StoriesSettings extends ServiceSettingSchema {
}

interface StoriesMethods {
}

interface StoriesLocalVars {
}

type StoriesThis = Service<StoriesSettings> & StoriesMethods & StoriesLocalVars;

const StoriesService: ServiceSchema<StoriesSettings> & { methods: StoriesMethods } = {
	name: "stories",
	mixins: [DbService("stories")],
	settings: {
		fields: ["_id", "cover", "title", "info", "tagList", "body", "author", "createdAt", "updatedAt", "slug"],
		populates: {
			author: {
				action: "users.get",
				params: {
					fields: ["username", "bio", "image"]
				},
			},
		},
		entityValidator: StoryValidator,
	},
	actions: {
		create: {
			auth: "required",
			rest: "POST /",
			async handler(
				this: StoriesThis,
				ctx: Context<ActionCreateParams, Meta>
			) {
				this.logger.info(ctx.meta);
				const id = ctx.meta.user?._id;
				if (!id) {
					this.logger.info("couldn't find user id");
					throw new Errors.MoleculerServerError("Couldn't find user id", 501, "", {});
				}
				await this.validateEntity(ctx.params.story);
				let body = ctx.params.story.body;
				if (body) {
					body = sanitizeHtml(body, {
							   allowedTags: ['b', 'i', 'strong', 'h1', 'h2', 'h3', 'p', 'br']
					});
				} else {
					body = ""
				}
				let entity: IStory = {
					...ctx.params.story,
					createdAt: new Date(),
					updatedAt: new Date(),
					slug: slug(ctx.params.story.title, { lower: true}) + "-" + (Math.random() * Math.pow(36, 6) | 0).toString(36),
					body: body,
					info: ctx.params.story.info || "",
					cover: ctx.params.story.cover || "",
					tagList: ctx.params.story.tagList || [],
					author: id,

				};

				const doc = await this.adapter.insert(entity);
				let json = await this.transformDocuments(ctx, { populate: ["author"] }, doc);
				json = await this.transformResult(ctx, json, ctx.meta.user);
				await this.entityChanged("created", json, ctx);
				return json;
			}
		},
		update: {
			auth: "required",
			params: {
				id: { type: "string" },
				story: {
					type: "object",
					props: {
						title: { type: "string", min: 1, optional: true },
						body: { type: "string", optional: true },
						info: { type: "string", optional: true },
						cover: { type: "string", optional: true },
						tagList: { type: "array", items: "string", optional: true },
					},
				},
			},
			async handler(
				this: StoriesThis,
				ctx: Context<ActionUpdateParams, Meta>
			) {
				await this.validateEntity(ctx.params.story);
				let newData = {
					...ctx.params.story,
					updatedAt: new Date(),
				};
				let story = await this.findBySlug(ctx.params.id);
				if (!story) {
					story = await this.adapter.findById(ctx.params.id);
				}
				if (!story) {
					throw new Errors.MoleculerClientError("Story not found", 404);
				}
				if (story.author !== ctx.meta.user?._id) {
					throw new ApiGateway.Errors.ForbiddenError("Forbidden", 403);
				}

				const update = {
					"$set": newData
				};

				const doc = await this.adapter.updateById(story._id, update);
				const entity = await this.transformDocuments(ctx, {
					populate: ["author"],
				}, doc);
				const json = await this.transformResult(ctx, entity, ctx.meta.user);
				this.entityChanged("updated", json, ctx);
				return json;
			},
		},
		delete: {
			auth: "required",
			async handler (
				this: StoriesThis,
				ctx: Context<ActionDeleteParams, Meta>
			) {
				let entity = await this.findBySlug(ctx.params.id);
				if (!entity) {
					entity = await this.adapter.findById(ctx.params.id);
				}
				if (!entity) {
					throw new Errors.MoleculerClientError("Story not found!", 404);
				}
				if (entity.author !== ctx.meta.user?._id) {
					throw new ApiGateway.Errors.ForbiddenError("Forbidden!", 403);
				}
				const res = await this.adapter.removeById(entity._id);
				await this.entityChanged("removed", res, ctx);
				return res;
			}
		},
		get: {
			cache: {
				keys: ["#userID", "id"],
			},
			rest: "GET /:id",
			populate: ["author"],
			async handler(
				this: StoriesThis,
				ctx: Context<ActionGetParams, Meta>
			) {
				this.logger.info("STORIES PARAMS:");
				this.logger.info(ctx.params);
				if (Array.isArray(ctx.params.id)) {
					return await this.adapter.findByIds(ctx.params.id);
				} else {
					return await this.adapter.findById(ctx.params.id);
				}
			},
			//async handler(
			//	this: StoriesThis,
			//	ctx: Context<ActionGetParams, Meta>
			//) {
			//	this.logger.info(ctx.params.id);
			//	let id: string[];
			//	if (Array.isArray(ctx.params.id)) {
			//		id = ctx.params.id;
			//	} else {
			//		id = [ctx.params.id]
			//	}
			//	
			//	let doc: string | string[];
			  //      doc = await Promise.all(id.map(async (id: string) => {
			//		this.logger.info(id);
			//		let res = await this.findBySlug(id);
			//		if (!res) {
			//			res = await this.adapter.findById(id);
			//		}
			//		if (!res) {
			//			throw new Errors.MoleculerClientError(`Story ${id} not found!`, 404);
			//		}
			//		return res;
			//	}));
			//	if (doc.length < 2) {
			//		doc = doc[0];
			//	}
//
//				let json = await this.transformDocuments(ctx, { populate: ["author"] }, doc);
//				return json;
//			}
		},
		list: {
			cache: {
				keys: ["#userID", "_id", "tag", "author", "limit", "offset"],
			},
			async handler(
				this: StoriesThis,
				ctx: Context<ActionListParams, Meta>
			) {
				const limit: Number | null = ctx.params.limit ? Number(ctx.params.limit) : 20;
				const offset: Number | null = ctx.params.offset ? Number(ctx.params.offset) : 0;

				let params: {
					limit: Number | null,
					offset: Number | null,
					sort: string[],
					populate: string[],
					query: {
						_id?: Object,
						tagList?: Object,
						author?: string,
					}
				} = {
					limit,
					offset,
					sort: ["-createdAt"],
					populate: ["author"],
					query: {},
				};
				
				if (ctx.params.id) {
					const id = Array.isArray(ctx.params.id) ? ctx.params.id : ctx.params.id.split(",");
					params.query._id = { "$in": id};
				}

				if (ctx.params.tag) {
					params.query.tagList = { "$in" : [ctx.params.tag] };
				}

				if (ctx.params.author) {
					const users: Array<IUser & { _id: string }> = await ctx.call("users.find", {
						query: { username: ctx.params.author }
					});
					if (users.length == 0) {
						throw new Errors.MoleculerClientError("Author not found");
					}
					params.query.author = users[0]._id;
				}


				const countParams = {...params};
				if (countParams && countParams.limit) {
					countParams.limit = null;
				}
				if (countParams && countParams.offset) {
					countParams.offset = null;
				}

				const res = await Promise.all([
					this.adapter.find(params),
					this.adapter.count(countParams)
				]);

				const docs = await this.transformDocuments(ctx, params, res[0]);
				const r = await this.transformResult(ctx, docs, ctx.meta.user);
				r.storiesCount = res[1];
				return r;
			},
		},
	},
	methods: {
		findBySlug(this: StoriesThis, slug: string) {
                        return this.adapter.findOne({ slug });
                },

                async transformResult(
                        this: StoriesThis,
                        ctx: Context<null, Meta>,
                        entities: Array<Object> | Object,
                        user: IUser & { _id: string }
                ) {
                        if (Array.isArray(entities)) {
                                const stories = await Promise.all(entities.map(item => this.transformEntity(ctx, item, user)));
                                return { stories };
                        } else {
                                const story = await this.transformEntity(ctx, entities, user);
                                return { story };
                        }
                },

                async transformEntity(
                        this: StoriesThis,
                        ctx: Context<null, Meta>,
                        entity: Object | undefined | null,
                        user: IUser & { _id: string }
                ) {
                        if (!entity) return null;
                        return entity;
                },
	},
};

export default StoriesService;
