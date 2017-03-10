import * as bookshelf from "Bookshelf";
export class BaseModel<R extends bookshelf.Model<R>> extends bookshelf.Model<R> {

    get(attribute: string) {
        const result = super.get(attribute);
        if (result === undefined) {
            throw new Error(`tried to access undefined attribute ${attribute} on model ${this.constructor.name}`);
        } else {
            return result;
        }
    }

}