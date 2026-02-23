const loader           = require('./_common/fileLoader');
const Pine             = require('qantra-pineapple');

/** 
 * load any file that match the pattern of function file and require them 
 * @return an array of the required functions
*/
module.exports = class ValidatorsLoader {
    constructor({models, customValidators}={}){
        this.models = models;
        this.customValidators = customValidators;
    }
    load(){

        const validators = {};

        /**
         * load schemes
         * load models ( passed to the consturctor )
         * load custom validators
         */
        const schemes = loader('./managers/**/*.schema.js');

        Object.keys(schemes).forEach(sk=>{
            let pine = new Pine({models: this.models, customValidators: this.customValidators});
            validators[sk] = {};
            Object.keys(schemes[sk]).forEach(s=>{
                validators[sk][s] =  async (data)=>{
                    const pineSchema = schemes[sk][s].map(({ in: _in, ...rest }) => rest);
                    return (await pine.validate(data, pineSchema));
                }
                /** also exports the trimmer function for the same */
                validators[sk][`${s}Trimmer`] = async (data)=>{
                    const pineSchema = schemes[sk][s].map(({ in: _in, ...rest }) => rest);
                    return (await pine.trim(data, pineSchema));
                }
            });
        })

        return validators;
    }
}