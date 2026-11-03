
require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    Events,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

// ================================
// AMERICAN BOT CONFIGURATION
// ================================

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const {
    DISCORD_TOKEN,
    GUILD_ID,
    APPROVAL_CHANNEL_ID,
    CONTRACT_CHANNEL_ID,
    STAFF_ROLE_ID
} = process.env;

// Temporary storage.
// We will replace this with PostgreSQL before Railway deployment.
const contracts = new Map();
const submissions = new Map();
const balances = new Map();

// ================================
// CONTRACT GENERATOR
// ================================

const airports = [
    'LCLK',
    'LCPH',
    'MDPC',
    'LCRA',
    'PAFA',
    'EGKK',
    'EGFF',
    'MDST'
];

const aircraft = [
    'A319-100',
    'A320-200',
    'A321-200',
    'B737-800',
    'B757-200',
    'A330-300',
    'A330-200',
    'B787-9',
    'B777-300',
    'MD-11',
    'Fokker 100',
    'B727-200'
];

const contractTypes = [
    'Scheduled Passenger',
    'Charter',
    'Cargo',
    'Special Operations'
];

const descriptions = [
    'Operations Control has authorized this assignment. Ground operations have confirmed that the aircraft is prepared for departure. Weather conditions are generally favorable, although crews should remain alert for changing conditions en route.',

    'The tarmac is bustling today as we prepare this aircraft for departure. Ground operations have confirmed that loading is complete and the aircraft is fully fueled. Please ensure your EFB is synchronized and push back on schedule.',

    'Operations Control has issued a new flight assignment. Crew members should review the dispatch release, verify aircraft performance requirements, and ensure compliance with all operational procedures.',

    'A time-sensitive movement has been scheduled. Dispatch requests that the crew maintain close coordination with ground personnel and ensure an efficient turnaround before departure.'
];

const randomItem = (array) =>
    array[Math.floor(Math.random() * array.length)];

function createContract() {
    const departure = randomItem(airports);

    let arrival;

    do {
        arrival = randomItem(airports);
    } while (arrival === departure);

    const plane = randomItem(aircraft);
    const type = randomItem(contractTypes);

    const baseValue = Math.floor(Math.random() * 9000) + 1000;

    const contract = {
        id: 'AAV-' + Math.floor(100000 + Math.random() * 900000),
        dispatch: 'AAV-' + Math.floor(10000 + Math.random() * 90000),
        type,
        departure,
        arrival,
        aircraft: plane,
        reward: baseValue,
        description: randomItem(descriptions),
        status: 'Available',
        claimedBy: null,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        approvalMessageId: null,
        publicMessageId: null
    };

    contracts.set(contract.id, contract);

    return contract;
}

  


// ================================
// CONTRACT EMBEDS
// ================================

function createApprovalEmbed(contract) {
    return new EmbedBuilder()
        .setColor(0xE3A008)
        .setTitle('✈️ NEW CONTRACT — AWAITING APPROVAL')
        .setDescription(contract.description)
        .addFields(
            { name: 'Contract ID', value: contract.id, inline: true },
            { name: 'Type', value: contract.type, inline: true },
            {
                name: 'Route',
                value: `${contract.departure} → ${contract.arrival}`,
            },
            { name: 'Aircraft', value: contract.aircraft, inline: true },
            {
                name: 'Reward',
                value: `$${contract.reward.toLocaleString('en-US')}`,
                inline: true
            },
            {
                name: 'Dispatch Release',
                value: contract.dispatch,
                inline: true
            },
            {
                name: 'Claim Before',
                value: `<t:${Math.floor(contract.expiresAt / 1000)}:F>`,
                inline: false
            }
        )
        .setFooter({ text: 'American Airlines Virtual • Staff Review' })
        .setTimestamp();
}

function createPublicEmbed(contract) {
    const status = contract.status === 'Claimed'
        ? 'Claimed'
        : 'Available';

    return new EmbedBuilder()
        .setColor(contract.status === 'Claimed' ? 0xE3A008 : 0xB71C1C)
        .setTitle('✈️ NEW FLIGHT CONTRACT')
        .setDescription(contract.description)
        .addFields(
            { name: 'Contract ID', value: contract.id, inline: true },
            { name: 'Type', value: contract.type, inline: true },
            {
                name: 'Route',
                value: `${contract.departure} → ${contract.arrival}`,
                inline: true
            },
            { name: 'Aircraft', value: contract.aircraft, inline: true },
            {
                name: 'Reward',
                value: `$${contract.reward.toLocaleString('en-US')}`,
                inline: true
            },
            {
                name: 'Status',
                value: status,
                inline: true
            },
            {
                name: 'Claimed By',
                value: contract.claimedBy
                    ? `<@${contract.claimedBy}>`
                    : 'No one yet',
                inline: true
            },
            {
                name: 'Dispatch Release Number',
                value: contract.dispatch,
                inline: true
            },
            {
                name: 'Claim Before',
                value: `<t:${Math.floor(contract.expiresAt / 1000)}:F>`,
                inline: false
            },
            {
                name: 'Instructions',
                value: 'When using `/flightlog`, enter this contract ID in the Contract ID field.',
                inline: false
            }
        )
        .setFooter({
            text: 'American Airlines Virtual Systems • Flight Operations'
        })
        .setTimestamp();
}

// ================================
// BUTTONS
// ================================

function approvalButtons(contractId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`approve_${contractId}`)
            .setLabel('Accept Contract')
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId(`deny_${contractId}`)
            .setLabel('Deny Contract')
            .setStyle(ButtonStyle.Danger)
    );
}

function claimButton(contractId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`claim_${contractId}`)
            .setLabel('Claim Contract')
            .setEmoji('🙋')
            .setStyle(ButtonStyle.Primary)
    );
}function createSubmissionEmbed(contract, pilot, screenshot) {
    return new EmbedBuilder()
        .setColor(0xE3A008)
        .setTitle('✈️ FLIGHT SUBMISSION — AWAITING REVIEW')
        .setDescription('A pilot has submitted a completed flight for review.')
        .addFields(
            {
                name: 'Pilot',
                value: `<@${pilot.id}>`,
                inline: true
            },
            {
                name: 'Contract ID',
                value: contract.id,
                inline: true
            },
            {
                name: 'Route',
                value: `${contract.departure} → ${contract.arrival}`,
                inline: true
            },
            {
                name: 'Aircraft',
                value: contract.aircraft,
                inline: true
            },
            {
                name: 'Reward',
                value: `$${contract.reward.toLocaleString('en-US')}`,
                inline: true
            }
        )
        .setImage(screenshot.url)
        .setFooter({ text: 'American Airlines Virtual • Flight Operations Review' })
        .setTimestamp();
}

function reviewButtons(contractId, pilotId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`review_approve_${contractId}_${pilotId}`)
            .setLabel('Approve Submission')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`review_deny_${contractId}_${pilotId}`)
            .setLabel('Deny Submission')
            .setStyle(ButtonStyle.Danger)
    );
}

// ================================
// SEND CONTRACT FOR APPROVAL
// ================================

async function submitContract(contract) {
    const channel = await client.channels.fetch(CONTRACT_CHANNEL_ID);

    if (!channel || !channel.isTextBased()) {
        throw new Error('Flight contracts channel not found.');
    }

    const message = await channel.send({
        embeds: [createPublicEmbed(contract)],
        components: [claimButton(contract.id)]
    });

    contract.publicMessageId = message.id;

    console.log(`Contract ${contract.id} published.`);
}

// ================================
// SLASH COMMANDS
// ================================

const commands = [
    new SlashCommandBuilder()
        .setName('generatecontract')
        .setDescription('Generate a new flight contract.'),

    new SlashCommandBuilder()
        .setName('submitflight')
        .setDescription('Submit a completed flight contract for staff review.')
        .addStringOption(option =>
            option
                .setName('contract_id')
                .setDescription('The unique ID of the contract you completed.')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option
                .setName('screenshot')
                .setDescription('Screenshot proving completion of the flight.')
                .setRequired(true)
        )
];

function isStaff(interaction) {
    return interaction.member?.roles?.cache?.has(STAFF_ROLE_ID) ?? false;
}

// ================================
// BOT STARTUP
// ================================

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`American Bot is online as ${readyClient.user.tag}!`);

    try {
        const guild = await client.guilds.fetch(GUILD_ID);

        await guild.commands.set(commands);

        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error('Command registration failed:', error);
    }

    // Automatically generate a contract every 120 minutes.
    setInterval(async () => {
        try {
            const contract = createContract();
            await submitContract(contract);
            console.log('Automatic contract generated.');
        } catch (error) {
            console.error('Automatic generation failed:', error);
        }
    }, 120 * 60 * 1000);
});

// ================================
// INTERACTION HANDLER
// ================================

client.on(Events.InteractionCreate, async (interaction) => {

    // =================================
    // SLASH COMMANDS
    // =================================

    if (interaction.isChatInputCommand()) {

        // GENERATE CONTRACT
        if (interaction.commandName === 'generatecontract') {

            if (!isStaff(interaction)) {
                return interaction.reply({
                    content: 'You do not have permission to generate contracts.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const contract = createContract();
                await submitContract(contract);

                await interaction.editReply(
                    `Contract **${contract.id}** published in #flight-contracts!`
                );

            } catch (error) {
                console.error(error);
                await interaction.editReply(
                    'There was an error generating the contract.'
                );
            }

            return;
        }

        // SUBMIT FLIGHT
        if (interaction.commandName === 'submitflight') {

            const contractId = interaction.options.getString('contract_id');
            const screenshot = interaction.options.getAttachment('screenshot');

            const contract = contracts.get(contractId);

            if (!contract) {
                return interaction.reply({
                    content: 'That contract ID does not exist.',
                    ephemeral: true
                });
            }

            if (contract.status !== 'Claimed') {
                return interaction.reply({
                    content: 'This contract has not been claimed or is no longer available.',
                    ephemeral: true
                });
            }

            if (contract.claimedBy !== interaction.user.id) {
                return interaction.reply({
                    content: 'You did not claim this contract.',
                    ephemeral: true
                });
            }

            if (submissions.has(contractId)) {
                return interaction.reply({
                    content: 'A submission for this contract is already awaiting review.',
                    ephemeral: true
                });
            }

            if (!screenshot.contentType?.startsWith('image/')) {
                return interaction.reply({
                    content: 'Please attach an image screenshot.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const reviewChannel = await client.channels.fetch(
                    APPROVAL_CHANNEL_ID
                );

                if (!reviewChannel || !reviewChannel.isTextBased()) {
                    throw new Error('Review channel not found.');
                }

                const reviewMessage = await reviewChannel.send({
                    embeds: [
                        createSubmissionEmbed(
                            contract,
                            interaction.user,
                            screenshot
                        )
                    ],
                    components: [
                        reviewButtons(contract.id, interaction.user.id)
                    ]
                });

                submissions.set(contractId, {
                    pilotId: interaction.user.id,
                    messageId: reviewMessage.id
                });

                await interaction.editReply(
                    `Your flight submission for **${contractId}** has been sent to staff for review!`
                );

            } catch (error) {
                console.error(error);

                await interaction.editReply(
                    'There was an error submitting your flight.'
                );
            }

            return;
        }
    }

    // =================================
    // BUTTON INTERACTIONS
    // =================================

    if (!interaction.isButton()) return;

    const parts = interaction.customId.split('_');

    // CLAIM CONTRACT
    
    // CLAIM CONTRACT
    if (parts[0] === 'claim') {

        const contractId = parts[1];
        const contract = contracts.get(contractId);

        if (!contract) {
            return interaction.reply({
                content: 'Contract not found. The bot may have restarted.',
                ephemeral: true
            });
        }

        if (contract.status !== 'Available') {
            return interaction.reply({
                content: 'This contract is no longer available.',
                ephemeral: true
            });
        }

        if (Date.now() > contract.expiresAt) {
            contract.status = 'Expired';

            return interaction.update({
                embeds: [createPublicEmbed(contract)],
                components: []
            });
        }

        // Claim the contract.
        contract.status = 'Claimed';
        contract.claimedBy = interaction.user.id;

        // Update the public contract message.
        await interaction.update({
            embeds: [createPublicEmbed(contract)],
            components: []
        });

        // Send the pilot a private copy.
        try {
            const claimedEmbed = createPublicEmbed(contract)
                .setTitle('📋 YOUR CLAIMED FLIGHT CONTRACT')
                .setColor(0x16A34A);

            await interaction.user.send({
                content: 'You have successfully claimed a flight contract! Keep this message for your records.',
                embeds: [claimedEmbed]
            });

            await interaction.followUp({
                content: '✅ Contract claimed! A copy has been sent to your DMs.',
                ephemeral: true
            });

        } catch (error) {
            console.log(`Could not DM pilot ${interaction.user.tag}.`);

            await interaction.followUp({
                content: '✅ Contract claimed, but I could not DM you. Please enable server DMs and ask staff for a copy.',
                ephemeral: true
            });
        }

        return;
    }


    // STAFF REVIEW
    if (parts[0] === 'review') {

        if (!isStaff(interaction)) {
            return interaction.reply({
                content: 'You are not authorized to review submissions.',
                ephemeral: true
            });
        }

        const decision = parts[1];
        const contractId = parts[2];
        const pilotId = parts[3];

        const contract = contracts.get(contractId);
        const submission = submissions.get(contractId);

        if (!contract || !submission || submission.pilotId !== pilotId) {
            return interaction.reply({
                content: 'This submission could not be found.',
                ephemeral: true
            });
        }

        if (contract.status !== 'Claimed') {
            return interaction.reply({
                content: 'This contract has already been processed.',
                ephemeral: true
            });
        }

        if (decision === 'approve') {

            // Prevent duplicate payouts.
            contract.status = 'Completed';

            const currentBalance = balances.get(pilotId) || 0;
            balances.set(pilotId, currentBalance + contract.reward);

            submissions.delete(contractId);

            const approvedEmbed = EmbedBuilder.from(
                interaction.message.embeds[0]
            )
                .setColor(0x16A34A)
                .setTitle('✅ FLIGHT SUBMISSION APPROVED')
                .addFields(
                    {
                        name: 'Approved By',
                        value: `<@${interaction.user.id}>`,
                        inline: true
                    },
                    {
                        name: 'Reward Paid',
                        value: `$${contract.reward.toLocaleString('en-US')}`,
                        inline: true
                    }
                );

            await interaction.update({
                embeds: [approvedEmbed],
                components: []
            });

            try {
                const pilot = await client.users.fetch(pilotId);

                await pilot.send(
                    `Your flight submission for **${contractId}** has been approved! You earned **$${contract.reward.toLocaleString('en-US')}**.`
                );
            } catch (error) {
                console.log('Could not send pilot a DM.');
            }

            console.log(
                `Paid ${pilotId} $${contract.reward} for contract ${contractId}.`
            );

            return;
        }

        if (decision === 'deny') {

            // Keep the contract claimed so the pilot can correct
            // their evidence and submit it again.
            submissions.delete(contractId);

            const deniedEmbed = EmbedBuilder.from(
                interaction.message.embeds[0]
            )
                .setColor(0xB71C1C)
                .setTitle('❌ FLIGHT SUBMISSION DENIED')
                .addFields({
                    name: 'Denied By',
                    value: `<@${interaction.user.id}>`
                });

            await interaction.update({
                embeds: [deniedEmbed],
                components: []
            });

            try {
                const pilot = await client.users.fetch(pilotId);

                await pilot.send(
                    `Your flight submission for **${contractId}** was denied. Please contact staff if you have questions.`
                );
            } catch (error) {
                console.log('Could not send pilot a DM.');
            }

            return;
        }
    }
});

   
client.login(DISCORD_TOKEN);
