import fs from "fs";
import type { Context, Service, ServiceSchema } from "moleculer";
import type { DbAdapter, MoleculerDB } from "moleculer-db";
import DbService from "moleculer-db";
import MongoDbAdapter from 'moleculer-db-adapter-mongo';

export type DbServiceMethods = {

};

type DbServiceSchema = Partial<ServiceSchema> &
	Partial<MoleculerDB<DbAdapter>>;

export type DbServiceThis = Service & DbServiceMethods;

export default function createDbServiceMixin(collection: string): DbServiceSchema {
	const schema: DbServiceSchema = {
		mixins: [DbService],
	};

	if (process.env.MONGO_URI) {
		// MongoDB adapter
		schema.adapter = new MongoDbAdapter(process.env.MONGO_URI);
		schema.collection = collection;
	} else if (process.env.NODE_ENV === "test") {
		// NeDB memory adapter for testing
		schema.adapter = new DbService.MemoryAdapter();
	} else {
		// NeDB file DB adapter

		// Create data folder
		if (!fs.existsSync("./data")) {
			fs.mkdirSync("./data");
		}

		schema.adapter = new DbService.MemoryAdapter({ filename: `./data/${collection}.db` });
	}

	return schema;
}
