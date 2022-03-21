/**
 * A simple interface for handling & preserving numerical coordinates and dimensions.
 * @typedef Dimensions
 * @property {String} unit The unit of measurement that applied to all values.
 * @property {Object} prev Previous set of coordinates.
 */
 class Dimensions {
    static allowedProps = ['x', 'y', 'z', 'height', 'width', 'margin', 'top', 'right', 'bottom', 'left'];

    constructor(obj, unit = 'px') {
        this.initFrom(obj, unit)
    }

    /**
     * Duplicate known values from any Object. Reset managed values and previous dimensions.
     * @param {Object} obj The object to find values in.
     * @param {String} unit The unit of measurement that applied to all values.
     * @param {Boolean} initPrev Whether to create & initialize the prev object.
     */
    initFrom(obj, unit = 'px', initPrev = true) {
        this.unit = unit;
        this._managedProps = new Set();
        if (initPrev) this.prev = {};

        for (const prop of Dimensions.allowedProps) {
            if (prop in obj) {
                this._managedProps.add(prop);
                this[prop] = obj[prop];
                if (initPrev) this.prev[prop] = 0;
            }
        } 
    }

    /**
     * Duplicate another Dimensions object.
     * @param {Coords} other The object to copy from.
     */
    copyFrom(other) {
        this.initFrom(other, other.unit, false);
        this.prev = {};

        for (const prop of other.prev) {
            this.prev[prop] = other.prev[prop];
        }
    }

    /** Backup the current values for future reference. */
    preserve() {
        this.prev = {};
        for (const prop of this._managedProps) {
            this.prev[prop] = this[prop];
        }
    }
}
