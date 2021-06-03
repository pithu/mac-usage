const util = require('util');
const { DateTimeFormatter, OffsetDateTime } = require('@js-joda/core');
const exec = util.promisify(require('child_process').exec);


const PERIOD = '2d'
const SEARCH_FOR = 'going inactive, create activity semaphore|releasing the activity semaphore'
const CMD = `log show --style syslog --predicate 'process == \"loginwindow\"' --debug --info --last ${PERIOD} | grep -E \"${SEARCH_FOR}\" | cut -c '1-32 141-155'`
const offsetFromatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssZ");

const getLogs = async () => {
	const { stdout, stderr } = await exec(CMD);
	if (stderr) {
		throw new Error(stderr);
	}
	return stdout.split('\n').filter(line => line.length > 0);
}

const mapToOffsetTime = (logs) => 
	logs.map(line => {
		const [date, time, ...activity] = line.split(' ')
		const odt = OffsetDateTime.parse(`${date}T${time.replace(/\.\d+/g, '')}`, offsetFromatter);
		return { odt, active: activity.some(v => v ==='active')};			
	})

const main = async () => {
	const logs = await getLogs();
	const rows = mapToOffsetTime(logs);
	rows.forEach(row => console.log(row.active, row.odt.toString()));
}

main();
