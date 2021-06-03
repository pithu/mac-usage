const util = require('util');
const { ChronoUnit, DateTimeFormatter, OffsetDateTime } = require('@js-joda/core');
const exec = util.promisify(require('child_process').exec);


const offsetFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssZ");

const getLogs = async (period) => {
	const searchFor = 'going inactive, create activity semaphore|releasing the activity semaphore'
	const cmd = `log show --style syslog --predicate 'process == \"loginwindow\"' --debug --info --last ${period} | grep -E \"${searchFor}\" | cut -c '1-32 141-155'`
	const { stdout, stderr } = await exec(cmd);
	if (stderr) {
		throw new Error(stderr);
	}
	return stdout.split('\n').filter(line => line.length > 0);
}

const mapToOffsetTime = (logs) => 
	logs.map(line => {
		const [date, time, ...activity] = line.split(' ')
		const odt = OffsetDateTime.parse(`${date}T${time.replace(/\.\d+/g, '')}`, offsetFormatter);
		return { odt, active: activity.some(v => v ==='active')};			
	})

const secsToTimeString = (secs) => new Date(secs * 1000).toISOString().substr(11, 8)

const createActivity = (onOdt, offOdt) => {
	const seconds = onOdt.until(offOdt, ChronoUnit.SECONDS);
	const time = secsToTimeString(seconds);
	return {
		on: onOdt,
		off: offOdt,
		seconds,
		time,
	};
}

const aggregateDays = (rows) => {
	let state = 'OFF';
	let currentOnOdt = null;
	let ld = null;
	const aggregatedDays = {};
	rows.forEach(row => {
		if (!ld) {
			ld = row.odt.toLocalDate().toString();
			if (!aggregatedDays[ld]) {
				aggregatedDays[ld] = { activities: [] };
			}
		}
		if (state === 'OFF') {
			if (row.active) {
				state = 'ON';
				if (!currentOnOdt) {
					currentOnOdt = row.odt;
				}
			}
		} else if (state === 'ON') {
			if (!row.active) {
				state = 'OFF';
				aggregatedDays[ld].activities.push(createActivity(currentOnOdt, row.odt));
				currentOnOdt = null;
				ld = null;
			}
		}
	})
	if (state === 'ON' && currentOnOdt) {
		aggregatedDays[ld].activities.push(createActivity(currentOnOdt, OffsetDateTime.now()));
	}
	return aggregatedDays;
}

const calculateDaySums = (aggregatedDays) => {
	const sumUpAggregatedDays = {};
	for (const [key, value] of Object.entries(aggregatedDays)) {
		const secs = value.activities.reduce((s, v) => s + v.seconds, 0);
		const time = secsToTimeString(secs)
		sumUpAggregatedDays[key] = {...value, secs, time };
	}
	return sumUpAggregatedDays;
}


const log = (aggregatedDays, verbose) => {
	for (const [date, aggregate] of Object.entries(aggregatedDays)) {
		console.log(`date: ${date} usage: ${aggregate.time} (${aggregate.secs} seconds)`)
		if (verbose)
			console.log('activities:', aggregate.activities.map(
				activity =>
					`on: ${activity.on.toString()}, off: ${activity.off.toString()}, time: ${activity.time}`
			))
	}
}

const report = async ({ period, verbose }) => {
	const logs = await getLogs(period);
	const rows = mapToOffsetTime(logs);
	// rows.forEach(row => console.log(row.active, row.odt.toString()));
	const aggregatedDays = aggregateDays(rows);
	log(calculateDaySums(aggregatedDays), verbose);
}

report({ period: '4d', verbose: false });
