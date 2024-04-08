import type { ServiceSchema, ServiceSettingSchema, Service, Context } from 'moleculer'
import { Errors } from 'moleculer';
import type { Meta } from '../types'
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import DbService from '../mixins/db.mixin';
import { UserValidator, type IUser } from "../models/user";

export interface ActionCreateParams {
  user: IUser,
}

export interface ActionLoginParams {
	email: string,
	password: string,
}

export interface ActionResolveTokenParams {
	token: string,
}

interface UsersSettings extends ServiceSettingSchema {
	rest: string,
	JWT_SECRET: string,
	fields: string[],
}

interface UsersMethods {
    generateJwt: (user: IUser) => string;
    transformEntity: (user: IUser, withToken: boolean, token?: string | null | undefined) => { user: IUser | IUser & { token: string } };
}

interface UsersLocalVars {
}

type UsersThis = Service<UsersSettings> & UsersMethods & UsersLocalVars

const UsersService: ServiceSchema<UsersSettings> & { methods: UsersMethods } = {
  name: 'users',
  mixins: [DbService("users")],
  settings: {
	  rest: "/",
	  JWT_SECRET: process.env.JWT_SECRET || "jwt-secret",
	  fields: ["_id", "username", "password", "email", "image"],
	  entityValidator: UserValidator,
  },
  actions: {
    create: {
      rest: "POST /",
      handler (this: UsersThis, ctx: Context<ActionCreateParams, Meta>) {
        return new this.Promise<object>((resolve, reject) => {
		const doc = this.adapter.insert(ctx.params.user);
		this.logger.info(doc);
        })
      }
    },

    login: {
    	rest: "POST /login",
	async handler(this: UsersThis, ctx: Context<ActionLoginParams, Meta>) {
		const { email, password } = ctx.params;
		const user = await this.adapter.findOne({ email });
		if (!user) {
			throw new Errors.MoleculerClientError("Email or password is invalid!", 422, "", [{ field: "email", message: "is not found" }]);
		}
		const res = await bcrypt.compare(password, user.password);
		if (!res) {
			throw new Errors.MoleculerClientError("Wrong password!", 422, "", [{ field: "email", message: "is not found" }]);
		}
		const doc = await this.transformDocuments(ctx, {}, user);
		return await this.transformEntity(doc, true, ctx.meta.user?.token);
	}
    },

    resolveToken: {
	    cache: {
		    keys: ["token"],
		    ttl: 60*60
	    },
	    async handler(this: UsersThis, ctx: Context<ActionResolveTokenParams, Meta>) {
		    const decoded = await new this.Promise((resolve, reject) => {
		    	jwt.verify(ctx.params.token, this.settings.JWT_SECRET, (err, decoded: unknown) => {
				if (err) {
					return reject(err);
				}
				resolve(decoded);
			});
		    });
		    const { id } = decoded as { id: string };
		    if (id) {
			    return this.getById(id);
		    }
	    }
    },

    me: {
    	auth: "required",
	rest: "GET /me",
	cache: {
		keys: ["#userID"]
	},
	async handler(this: UsersThis, ctx: Context<null, Meta>) {
		const user = await this.getById(ctx.meta.user?._id);
		if (!user) {
			throw new Errors.MoleculerClientError("User not found!", 400);
		}
		const doc = await this.transformDocuments(ctx, {}, user);
		return await this.transformEntity(doc, true, ctx.meta.user?.token);
	}
    }
  },
  methods: {
    generateJwt(user: IUser) {
	    const today = new Date();
	    const exp = new Date(today);
	    exp.setDate(today.getDate() + 60);

	    return jwt.sign({
		    id: user._id,
		    username: user.username,
		    exp: Math.floor(exp.getTime() / 1000),
	    }, this.settings.JWT_SECRET);
    },

    transformEntity(user: IUser, withToken: boolean, token?: string | null | undefined) {
	    if (user) {
	    	user.image = user.image || "";
		if (withToken && token) {
	    		const userWithToken: IUser & { token: string } = {...user, token: ""};
			userWithToken.token = token || this.generateJwt(user);
			return { user: userWithToken };
		}
	    }
	    return { user };
    },
  },
}

export default UsersService
