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
				line: number
				ignorable: boolean
			}[]
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	errors: any[]
}

export class PHPStan {
	static parseResult(stdout: string): ResultType {
		return JSON.parse(stdout)
	}
}
