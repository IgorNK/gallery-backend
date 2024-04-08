import type { ServiceSchema, ServiceSettingSchema, Service, Context } from 'moleculer'
import type { Meta } from '../types'

export interface ActionSaveParams {
  on: (message: string, callback: (arg: any) => any) => any
  pipe: (arg: any) => any

}

interface StorageSettings extends ServiceSettingSchema {

}

interface StorageMethods {
  randomName: () => string
}

interface StorageLocalVars {
}

type StorageThis = Service<StorageSettings> & StorageMethods & StorageLocalVars

const StorageService: ServiceSchema<StorageSettings> & { methods: StorageMethods } = {
  name: 'storage',
  settings: {

  },
  actions: {
    save: {
      handler (this: StorageThis, ctx: Context<ActionSaveParams, Meta>) {
        return new this.Promise<object>((resolve, reject) => {

        })
      }
    },

  },
  methods: {
    randomName () {
      return 'unnamed_' + Date.now()
    },
  },
  async started (this) {

  }
}

export default StorageService
