export class ApplicationException extends Error {
	constructor(
		readonly code: string,
		message = code,
	) {
		super(message);
		this.name = ApplicationException.name;
	}
}
