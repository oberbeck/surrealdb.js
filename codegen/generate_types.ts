import {InterfaceDeclaration, NodeArray, TypeAliasDeclaration, TypeElement} from "typescript";
import axios, {AxiosResponse} from 'axios';
import * as ts from "typescript";
import {factory} from "typescript";
import * as fs from "fs";
import {Command} from 'commander';

interface RegularStructure {
	name: string;
	type: string;
}

interface RecordStructure {
	name: string;
	type: {
		table: string,
		type: string,
	};
}

interface ProcessedStructure {
	name: string;
	type: string;
}

type Structure = RegularStructure | RecordStructure;
type Structures = { [key: string]: Structure[] };


const program = new Command();

/**
 * NOTE:
 * This requires this PR for it to work, until it's merged:
 * https://github.com/surrealdb/surrealdb/pull/1241
 * 
 * SIMPLE USAGE:
 * cd codegen
 * yarn / npm install
 *
 * ./node_modules/.bin/ts-node generate_types.ts --namespace test --database application --user root --pass secret --host http://0.0.0.0:4269
 *
 * You can generate to specific path:
 * ./node_modules/.bin/ts-node generate_types.ts --namespace test --database application --user root --pass secret --output ~/types.d.ts --host http://0.0.0.0:4269
 */

program
	.requiredOption('--namespace <namespace>', 'namespace name to use')
	.requiredOption('--database <database>', 'database name to use')
	.requiredOption('--user <user>', 'Root username to use', 'root')
	.requiredOption('--pass <pass>', 'Root password to use', 'root')
	.option('--output <output>', 'Path to output the typescript definition file', './models.d.ts')
	.option('--host <host>', 'The host of your surreal database', 'http://localhost:8000');

program.parse();

const options = program.opts<{
	namespace: string;
	database: string;
	user: string;
	pass: string;
	output: string;
	host: string,
}>();

const {namespace, database, user, pass, output, host} = options;

async function getStructures(): Promise<AxiosResponse<Structures>> {
	return await axios.post<Structures>(host + '/structure', undefined, {
		headers : {
			NS            : namespace,
			DB            : database,
			Accept        : 'application/json',
			Authorization : 'Basic ' + Buffer.from(user + ":" + pass).toString('base64'),
		},
	});
}

function toPascalCase(string) {
	return `${string}`
		.toLowerCase()
		.replace(new RegExp(/[-_]+/, 'g'), ' ')
		.replace(new RegExp(/[^\w\s]/, 'g'), '')
		.replace(
			new RegExp(/\s+(.)(\w*)/, 'g'),
			($1, $2, $3) => `${$2.toUpperCase() + $3}`
		)
		.replace(new RegExp(/\w/), s => s.toUpperCase());
}

function createSDBModelNode(models: string[]): TypeAliasDeclaration {
	return factory.createTypeAliasDeclaration(
		[factory.createModifier(ts.SyntaxKind.ExportKeyword)],
		factory.createIdentifier("Models"),
		undefined,
		factory.createTypeReferenceNode(
			factory.createIdentifier("SDBModel"),
			[factory.createTypeLiteralNode([factory.createPropertySignature(
				undefined,
				factory.createIdentifier(namespace),
				undefined,
				factory.createTypeLiteralNode([factory.createPropertySignature(
					undefined,
					factory.createIdentifier(database),
					undefined,
					factory.createTypeLiteralNode(
						models.map(model => factory.createPropertySignature(
							undefined,
							factory.createIdentifier(model),
							undefined,
							factory.createArrayTypeNode(factory.createTypeReferenceNode(
								factory.createIdentifier(model),
								undefined
							))
						))
					)
				)])
			)])]
		)
	);
}

function createModelInterface(modelName: string, fields: readonly TypeElement[]): InterfaceDeclaration {
	return factory.createInterfaceDeclaration(
		[factory.createModifier(ts.SyntaxKind.ExportKeyword)],
		factory.createIdentifier(modelName),
		undefined,
		undefined,
		fields
	);
}

function createField(field: ProcessedStructure): TypeElement {
	return factory.createPropertySignature(
		undefined,
		factory.createIdentifier(field.name),
		undefined,
		factory.createTypeReferenceNode(
			factory.createIdentifier(field.type),
			undefined
		)
	);
}

function fieldPrimitiveType(type: string): string {
	switch (type) {
		case "null":
			return "SDBNull";
		case "string":
			return "SDBString";
		case "uuid":
			return "SDBUuid";
		case "int":
		case "number":
			return "SDBNumber";
		case "boolean":
		case "bool":
			return "SDBBoolean";
		case "time":
			return "string";
		case "datetime":
			return "Date";
		case "object":
			return "SDBObject";
		default:
			return "unknown";
	}
}

function generateTableTypes(structures: Structures): ts.NodeArray<any> {
	const nodes: any[] = [];
	const models       = [];

	for (let key in structures) {
		const structureFields = structures[key];
		const modelName       = toPascalCase(key);

		const processedFields: ProcessedStructure[] = structureFields.reduce((acc, field, currentIndex: number, array: Structure[]) => {
			if (field.name.includes('[*]')) return acc;

			if (field.type === 'array') {
				const arrFieldType = array.find(f => f.name === field.name + '[*]');
				let fieldType      = 'Array<any>';
				if (arrFieldType) {
					fieldType = typeof arrFieldType.type === 'string'
						? `Array<${fieldPrimitiveType(arrFieldType.type)}>`
						: `SDBRecordLink<${toPascalCase(arrFieldType.type.table)}>`;
				}
				field.type = fieldType;
				acc.push(field);
				return acc;
			}

			if (typeof field.type === 'string') {
				field.type = fieldPrimitiveType(field.type);
				acc.push(field);
				return acc;
			}

			field.type = toPascalCase(field.type.table);
			acc.push(field);
			return acc;
		}, []);

		const modelInterface = createModelInterface(modelName, processedFields.map(createField));
		models.push(modelName);
		nodes.push(modelInterface);
	}


	nodes.push(createSDBModelNode(models));

	return ts.factory.createNodeArray(nodes);
}

async function process() {
	const structuresResponse = await getStructures();
	const structures         = structuresResponse.data;
	const nodes              = generateTableTypes(structures);

	const resultFile = ts.createSourceFile(
		"types.d.ts",
		"",
		ts.ScriptTarget.ES2022,
		/*setParentNodes*/ false,
		ts.ScriptKind.TS
	);

	const printer = ts.createPrinter({newLine : ts.NewLineKind.LineFeed});

	const result = printer.printList(
		ts.ListFormat.MultiLine,
		nodes,
		resultFile
	);


	fs.writeFileSync(output, result);

	console.log(result);
}


process().then(() => console.log('Finished.')).catch(err => console.error(err));
