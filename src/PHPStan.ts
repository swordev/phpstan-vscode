import { isAbsolute, join, normalize } from "path"
import { checkFile, parseYaml } from "./util"

export type ResultType = {
	totals: {
		errors: number
		file_errors: number
	}
	files: {
		[path: string]: {
			errors: number
			messages: {
				message: string
				line: number | null
				ignorable: boolean
			}[]
		}
	}
	errors: string[]
}

export type ConfigType = {
	parameters?: {
		paths: string[]
		excludes_analyse: string[]
		fileExtensions: string[]
	}
}

export class PHPStan {
	static settings: {
		rootPath: string
		basenames: string[]
		path: string
	}

	static resolveConfigItemValue(value: string): string {
		const rootDir = join(PHPStan.settings.rootPath, PHPStan.settings.path)
		return value
			.replace(/%currentWorkingDirectory%/g, PHPStan.settings.rootPath)
			.replace(/%rootDir%/g, rootDir)
	}

	static resolveConfigItemPath(value: string): string {
		value = PHPStan.resolveConfigItemValue(value)
		if (!isAbsolute(value)) value = join(PHPStan.settings.rootPath, value)
		return normalize(value)
	}

	static async findConfigPath(): Promise<string | null> {
		const dir = PHPStan.settings.rootPath
		for (const basename of PHPStan.settings.basenames) {
			const path = join(dir, basename)
			if (await checkFile(path)) {
				return path
			}
		}
		return null
	}

	static async parseConfig(
		path: string,
		resolve = true
	): Promise<ConfigType> {
		const config = await parseYaml<ConfigType>(path)
		return resolve ? PHPStan.resolveConfig(config) : config
	}

	static resolveConfig(config: ConfigType): ConfigType {
		config = Object.assign({}, config)
		config.parameters = Object.assign({}, config.parameters)
		const params = config.parameters
		if (Array.isArray(params.paths))
			params.paths = params.paths.map((v) =>
				PHPStan.resolveConfigItemPath(v)
			)
		if (Array.isArray(params.excludes_analyse))
			params.excludes_analyse = params.excludes_analyse.map((v) =>
				PHPStan.resolveConfigItemPath(v)
			)

		if (!Array.isArray(params.fileExtensions)) params.fileExtensions = []

		if (!params.fileExtensions.length) params.fileExtensions.push("php")

		return config
	}

	static parseResult(stdout: string): ResultType {
		return JSON.parse(stdout)
	}
}
