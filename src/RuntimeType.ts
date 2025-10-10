export const getType = (value: any) => {
    return Object.prototype.toString
        .call(value)
        .substring(8)
        .replace("]", "")
        .toLowerCase();
}

export const isGenericObject = (value: any) => {
    return getType(value) === "object";
}