export class ApplicationException extends Error {
	constructor(
		readonly code: string,
		readonly statusCode: number,
		message = code,
	) {
		super(message);
		this.name = ApplicationException.name;
	}
}
