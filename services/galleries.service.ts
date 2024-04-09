import type { ServiceSchema, ServiceSettingSchema, Service, Context } from 'moleculer';
import { Errors } from 'moleculer';
import type { Meta } from '../types';
import DbService from '../mixins/db.mixin';
import { GalleryValidator, type IGallery } from '../models/gallery';
import { type IUser } from '../models/user';
import slug from 'slug';

export interface ActionCreateParams {
	title: string,
	subtitle: string,
	cover?: string,
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
					fields: ["username", "bio", "image"]
				}
			},
			stories: {
				action: "stories.get",
				params: {
					fields: ["_id", "cover", "info", "title", "slug", "author"],
					populates: ["author"]
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
				await this.validateEntity(ctx.params);
				let entity: IGallery = {
					...ctx.params,
					createdAt: new Date(),
					updatedAt: new Date(),
					slug: slug(ctx.params.title, { lower: true}) + "-" + (Math.random() * Math.pow(36, 6) | 0).toString(36),
					stories: [],
					author: id,
					cover: ctx.params.cover || "",
				};

				const doc = await this.adapter.insert(entity);
				let json = await this.transformDocuments(ctx, { populate: ["author", "stories"] }, doc);
				json = await this.transformResult(ctx, json, ctx.meta.user);
				await this.entityChanged("created", json, ctx);
				return json;
			}
		},
	},
	methods: {
		findBySlug(this: GalleriesThis, slug: string) {
			return this.adapger.findOne({ slug });
		},

		async transformResult(
			this: GalleriesThis,
			ctx: Context<null, Meta>,
			entities: Array<Object> | Object,
			user: IUser & { _id: string }
		) {
			if (Array.isArray(entities)) {
				const galleries = await this.PromiseLike.all(entities.map(item => this.transformEntity(ctx, item, user)));
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
