import type { Context, ServiceSchema } from 'moleculer'
import type { ApiSettingsSchema, GatewayResponse, IncomingRequest, Route } from 'moleculer-web'
import ApiGateway from 'moleculer-web'
import type { Meta } from '../types'
import { type IUser } from '../models/user';

const ApiService: ServiceSchema<ApiSettingsSchema> = {
  name: 'api',
  mixins: [ApiGateway],

  settings: {
    port: process.env.PORT != null ? Number(process.env.PORT) : 3000,
    ip: '0.0.0.0',
    cors: {
      origin: '*',
      methods: ['POST', 'PUT', 'GET', 'PATCH'],
      allowedHeaders: ['Content-Type']
    },
    routes: [
      {
        path: '/upload',

	authorization: true,

        whitelist: ['**'],

        // Disable body parsers
        bodyParsers: {
          json: false,
          urlencoded: false
        },

        aliases: {
          // File upload from HTML form
          'POST /': 'multipart:storage.save',

          'POST /multi': {
            type: 'multipart',
            busboyConfig: {
              limits: {
                files: 3,
                fileSize: 1 * 1024 * 1024
              }
            },
            action: 'storage.save'
          }
        },

        // Route level busboy config
        busboyConfig: {
          limits: {
            files: 1
          }
        },

        // Calling options. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Calling-options
        callOptions: {},

        // Mapping policy setting. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Mapping-policy
        mappingPolicy: 'restrict', // Available values: "all", "restrict"

        // Enable/disable logging
        logging: true
      },
      {
      	path: "/users",
	authorization: true,
	autoAliases: true,
	bodyParsers: {
		json: {
			strict: false
		},
		urlencoded: {
			extended: false
		}
	}
      },
    ],

    // Do not log client side errors (does not log an error response when the error.code is 400<=X<500)
    log4XXResponses: false,
    // Logging the request parameters. Set to any log level to enable it. E.g. "info"
    logRequestParams: null,
    // Logging the response data. Set to any log level to enable it. E.g. "info"
    logResponseData: null
  },

  methods: {
	  async authenticate(
		  ctx: Context,
		  route: Route,
		  req: IncomingRequest
	  ): Promise<Record<string, unknown> | null> {
		  let token;
		  if (req.headers.authorization) {
		  	let type = req.headers.authorization.split(" ")[0];
			if (type === "Token" || type === "Bearer") {
				token = req.headers.authorization.split(" ")[1];
			}
		  }
		  let user: IUser;
		  if (token) {
		  	try {
				user = await ctx.call("users.resolveToken", { token });
				if (user) {
					this.logger.info("Authenticated via JWT: ", user.username);
					return { userID: user._id, token };
				}
			} catch (err) {

			}
		  }
		  return null;
	  },
	  authorize(
		  ctx: Context<null, Meta>, 
		  route: Route, 
		  req: IncomingRequest
	  ) {
		  const { user } = ctx.meta;
		  if (req.$action.auth === "required" && !user) {
		  	throw new ApiGateway.Errors.UnAuthorizedError("NO_RIGHTS", null);
		  }
	  }
  }
}

export default ApiService
