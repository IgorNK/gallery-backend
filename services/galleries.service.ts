import type { ServiceSchema, ServiceSettingSchema, Service, Context } from 'moleculer';
import { Errors } from 'moleculer';
import ApiGateway from 'moleculer-web';
import type { Meta } from '../types';
import DbService from '../mixins/db.mixin';
import { GalleryValidator, type IGallery } from '../models/gallery';
import { type IUser } from '../models/user';
import { type IStory } from '../models/story';
import slug from 'slug';

export interface ActionCreateParams {
	gallery: {
		title: string,
		subtitle: string,
		cover?: string,
	}
}

export interface ActionGetParams {
	id: string
}

export interface ActionListParams {
	id?: string | string[],
	title?: string | string[],
	tag?: string | string[],
	author?: string | string[],
	story?: string | string[],
	limit?: number,
	offset?: number,
}

export interface ActionUpdateParams {
	id: string,
	gallery: {
		title?: string,
		tagList: string[],
		subtitle?: string,
		cover?: string,
		stories?: string[],
	}
}

export interface ActionDeleteParams {
	id: string
}

interface GalleriesSettings extends ServiceSettingSchema {
}

interface GalleriesMethods {
	
}

interface GalleriesLocalVars {

}

type GalleriesThis = Service<GalleriesSettings> & GalleriesMethods & GalleriesLocalVars;

const GalleriesService: ServiceSchema<GalleriesSettings> & { methods: GalleriesMethods } = {
	name: 'galleries',
	mixins: [DbService("galleries")],
	settings: {
		fields: ["_id", "cover", "title", "subtitle", "author", "stories", "createdAt", "updatedAt", "slug"],
		populates: {
			author: {
				action: "users.get",
				params: {
					fields: ["_id", "username", "bio", "image"]
				}
			},
			stories: {
				action: "stories.get",
				params: {
					fields: ["_id", "cover", "info", "title", "slug", "author"],
					populate: ["author"]
				}
			}
		},
		entityValidator: GalleryValidator,
	},
	actions: {
		create: {
			auth: "required",
			async handler(
				this: GalleriesThis, 
				ctx: Context<ActionCreateParams, Meta>
			) {
				const id = ctx.meta.user?._id;
				if (!id) {
					this.logger.info("Couldn't find user id");
					throw new Errors.MoleculerServerError("Couldn't find user id", 501, "", {});
				}
				await this.validateEntity(ctx.params.gallery);
				let entity: IGallery = {
					...ctx.params.gallery,
					tagList: [],
					createdAt: new Date(),
					updatedAt: new Date(),
					slug: slug(ctx.params.gallery.title, { lower: true}) + "-" + (Math.random() * Math.pow(36, 6) | 0).toString(36),
					stories: [],
					author: id,
					cover: ctx.params.gallery.cover || "",
				};

				const doc = await this.adapter.insert(entity);
				let json = await this.transformDocuments(ctx, { populate: ["author", "stories"] }, doc);
				json = await this.transformResult(ctx, json, ctx.meta.user);
				await this.entityChanged("created", json, ctx);
				return json;
			}
		},
		get: {
			cache: {
				keys: ["#userID", "id"]
			},
			async handler(
				this: GalleriesThis,
				ctx: Context<ActionGetParams, Meta>
			) {
				let id = ctx.params.id;
				let doc = await this.findBySlug(ctx.params.id);
				if (doc) {
					id = doc._id;
				}
				let params = this.sanitizeParams(ctx, {
					...ctx.params,
					id,
					populate: ["author", "stories"]
				});
				return this._get(ctx, params);
			}
		},
		list: {
			cache: {
				keys: ["#userID", "tag", "author", "_id", "title", "stories", "limit", "offset"]
			},
			async handler(
				this: GalleriesThis,
				ctx: Context<ActionListParams, Meta>
			) {
				const limit = ctx.params.limit ? Number(ctx.params.limit) : 20;
				const offset = ctx.params.offset ? Number(ctx.params.offset) : 0;
				
				let params: {
					limit: Number | null,
					offset: Number | null,
					sort: string[],
					populate: string[],
					query: {
						_id?: Object,
						tagList?: Object,
						title?: Object,
						author?: Object,
						stories?: Object,
					}
				} = {
					limit,
					offset,
					sort: ["-createdAt"],
					populate: ["author", "stories"],
					query: {}
				};

				if (ctx.params.id) {
					const id = Array.isArray(ctx.params.id) ? ctx.params.id : ctx.params.id.split(",");
					params.query._id = { "$in": id };
				}

				if (ctx.params.title) {
					const title = Array.isArray(ctx.params.title) ? ctx.params.title : ctx.params.title.split(",");
					params.query.title = { "$in": title };
				}

				if (ctx.params.tag) {
					const tag = Array.isArray(ctx.params.tag) ? ctx.params.tag : ctx.params.tag.split(",");
					params.query.tagList = { "$in": tag };
				}

				if (ctx.params.author) {
					const author = Array.isArray(ctx.params.author) ? ctx.params.author : ctx.params.author.split(",");
					const users: Array<IUser & { _id: string }> = await ctx.call("users.find", {
						query: { username: { "$in": author } }
					});
					if (users.length == 0) {
						throw new Errors.MoleculerClientError("Author not found");
					}
					params.query.author = { "$in": users.map(u => u._id) };
				}
				if (ctx.params.story) {
					const story = Array.isArray(ctx.params.story) ? ctx.params.story : ctx.params.story.split(",");
					const stories: Array<IStory & { _id: string }> = await ctx.call("stories.find", {
						query: { title: { "$in": story } }
					});
					if (stories.length == 0) {
						throw new Errors.MoleculerClientError("Story not found");
					}
					params.query.stories = { "$in": stories.map(s => s._id) };
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
				r.galleriesCount = res[1];
				return r;
			}
		},
		update: {
			auth: "required",
			async handler(
				this: GalleriesThis,
				ctx: Context<ActionUpdateParams, Meta>
			) {
				let gallery = await this.findBySlug(ctx.params.id);
				if (!gallery) {
					gallery = await this.adapter.findById(ctx.params.id);
				}
				if (!gallery) {
					throw new Errors.MoleculerClientError("Gallery not found!", 404);
				}
				if (gallery.author !== ctx.meta.user?._id) {
					throw new ApiGateway.Errors.ForbiddenError("Forbidden!", 403);
				}
				let newData: IGallery = {
					...gallery,
					...ctx.params.gallery,
					updatedAt: new Date(),
				};
				await this.validateEntity(newData);
				const update = {
					"$set": newData
				};
				const doc = await this.adapter.updateById(gallery._id, update);
				this.logger.info(doc);
				const entity = await this.transformDocuments(ctx, { populate: ["author", "stories"] }, doc);
				this.logger.info(entity);
				const json = await this.transformResult(ctx, entity, ctx.meta.user);
				this.entityChanged("updated", json, ctx);
				return json;
						
			}
		},
		delete: {
			auth: "required",
			async handler (
				this: GalleriesThis,
				ctx: Context<ActionDeleteParams, Meta>
			) {
				let entity = await this.findBySlug(ctx.params.id);
				if (!entity) {
					entity = await this.adapter.findById(ctx.params.id);
				}
				if (!entity) {
					throw new Errors.MoleculerClientError("Gallery not found!", 404);
				}
				if (entity.author !== ctx.meta.user?._id) {
					throw new ApiGateway.Errors.ForbiddenError("Forbidden!", 403);
				}
				const res = await this.adapter.removeById(entity._id);
				await this.entityChanged("removed", res, ctx);
				return res;

			}
		},
	},
	methods: {
		findBySlug(this: GalleriesThis, slug: string) {
			return this.adapter.findOne({ slug });
		},

		async transformResult(
			this: GalleriesThis,
			ctx: Context<null, Meta>,
			entities: Array<Object> | Object,
			user: IUser & { _id: string }
		) {
			if (Array.isArray(entities)) {
				const galleries = await Promise.all(entities.map(item => this.transformEntity(ctx, item, user)));
				return { galleries };
			} else {
				const gallery = await this.transformEntity(ctx, entities, user);
				return { gallery };
			}
		},

		async transformEntity(
			this: GalleriesThis,
			ctx: Context<null, Meta>,
			entity: Object | undefined | null,
			user: IUser & { _id: string }
		) {
			if (!entity) return null;
			return entity;
		},
	},
};

export default GalleriesService;
