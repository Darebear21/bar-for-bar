'use strict';
/* ================= helpers ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); };
const fmtSec = s => { const m = Math.floor(s / 60); const r = s - m * 60; return m + ':' + r.toFixed(1).padStart(4, '0'); };
const rand = n => Math.floor(Math.random() * n);
const shuffle = (a, rnd = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
// repeatable random numbers from a 32-bit seed (mulberry32): online battles draw the same words on every device
function seededRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
};

/* ================= rhyme families =================
   one family per line; underscores become spaces ("said_it" -> "said it") */
const RAW = {
basic: `
way day say play pay stay okay bay survey ray lay grey clay yea anime spray
right night light fight flight bright tight sight height white quite despite bite invite slight polite
time prime climb lime dime rhyme crime
fire higher entire tired desire wire buyer inspire
know go show though below grow slow throw flow glow pro hello snow row blow owe
part start heart art smart chart cart dart
same game name claim blame frame aim fame flame shame dame lame tame
school cool rule fuel pool tool jewel fool stool
why high try eye supply fly sky goodbye guy buy lie apply dry cry nearby tie
thing bring king spring ring wing sing string swing sting ping ding
down town brown crown clown gown frown drown noun
found sound ground round bound pound renowned mound
street meet complete beat feet sweet heat seat repeat elite treat defeat concrete sheet compete fleet
look took book cook hook shook brook crook
cash crash flash smash dash clash splash stash trash ash bash rash slash hash mash
make take break lake wake fake cake shake snake sake stake bake
main pain train brain explain gain plane rain chain campaign maintain contain obtain insane complain grain
old told hold gold cold sold controlled bold fold mold
team seem dream supreme stream cream extreme scheme beam theme steam regime scream meme esteem redeem
rock stock block lock shock clock knock dock mock flock sock
said head red instead bed spread bread thread dread tread
find kind mind behind signed blind grind rewind confined bind
when then again men ten pen zen den yen hen
that cat flat chat mat hat bat pat rat vat
love above glove dove shove
best west rest test chest dressed impressed quest nest suggest guest invest depressed obsessed crest pest
far car star bar guitar jar scar par bizarre cigar
more before door store floor score core shore explore pour four war ignore sore bore roar
me free key sea agree tree guarantee three degree tea fee knee ski nominee plea debris
own phone alone stone zone grown tone bone throne known loan blown drone prone cone clone
room assume boom bloom consume zoom broom gloom costume resume tomb doom perfume groom presume
one done run fun sun begun ton none bun pun
chance dance advance romance stance glance finance enhance lance
nice price ice advice twice paradise slice dice rice precise spice
gave save wave brave cave behave rave crave grave shave
soon moon tune noon cartoon balloon spoon immune typhoon platoon
ship trip tip chip slip flip grip whip hip rip clip skip lip dip zip sip
hand understand land band grand demand brand planned command sand expand strand withstand canned bland
all call small fall wall ball hall tall mall stall crawl brawl
keep deep sleep cheap steep sweep leap heap sheep creep jeep reap
back black attack track pack crack stack snack lack jack hack sack rack slack plaque smack
here year near clear career fear appear gear cheer dear severe premier rear volunteer peer mere
between mean seen green clean machine queen screen marine dean routine teen lean keen vaccine bean
yes less guess press success dress stress mess chess bless assess possess confess recess
feel real deal wheel meal reveal steal heal appeal seal repeal peel conceal
bit hit fit sit split admit quit kit commit submit pit permit lit wit spit transmit
you do new too through true view blue crew debut pursue screw shoe clue zoo coup
half staff laugh graph calf giraffe
week speak unique peak technique creek sneak cheek tweak seek leak freak streak antique critique chic
match catch patch scratch batch hatch latch attach snatch
home dome chrome foam comb roam
box fox blocks rocks socks locks knocks clocks
map cap gap trap tap snap wrap rap nap clap app lap slap scrap strap chap
please trees cheese keys ease knees freeze breeze tease overseas squeeze seize
serve nerve curve
scale mail fail trail tale nail sail whale stale jail detail rail pale bail hail shale
age page stage wage engage cage rage gauge sage
talk walk hawk chalk stalk
had bad add dad glad sad mad rad pad lad grad clad
place case face space race base grace chase ace pace trace lace brace erase vase
luck stuck truck struck duck buck puck tuck
there where care air share hair fair aware bear chair square rare pair prepare swear compare
some come sum drum thumb hum numb dumb mum gum plum
jump pump dump bump lump stump
will still until hill fill skill chill spill thrill bill till mill drill pill grill gill
vote note wrote boat quote coat throat goat float promote remote
hurt shirt alert dirt insert skirt dessert assert flirt
announce bounce ounce
edge pledge hedge wedge ledge
line fine design mine nine divine shine pine resign spine shrine assign align benign
dog blog log fog frog jog
up cup pup
need read lead speed agreed indeed feed seed succeed freed proceed breed exceed bleed creed plead
top stop drop shop pop hop crop chop flop mop cop swap prop
within win skin begin spin twin chin grin pin bin inn tin violin fin akin shin
can man plan began fan ran van scan span ban pan tan clan sedan
rich switch pitch ditch twitch stitch glitch itch witch niche
gift shift lift swift drift rift
broke joke smoke spoke stroke woke poke cloak folk oak stoke choke soak bloke provoke
allowed proud crowd loud cloud vowed
house mouse spouse blouse
boys noise toys employs destroys joys
born worn corn horn torn sworn thorn
fresh flesh mesh
hang gang bang sang rang slang fang tang
park mark dark shark spark bark arc stark
hard card guard yard regard
thank bank tank rank blank drank prank plank frank flank crank
squad odd rod nod cod pod quad
describe tribe subscribe vibe bribe
across loss boss toss moss gloss sauce
saw draw raw straw jaw flaw claw paw law
did kid lid hid slid mid rid bid grid
control goal soul roll hole bowl coal poll stole patrol toll scroll parole troll mole stroll
wish fish dish swish
would good could stood hood
news lose choose shoes blues cruise refuse accuse confuse muse misuse
class pass mass glass grass gas bass brass
bag flag tag drag brag lag gag rag
pick quick sick stick kick trick thick click nick brick chick tick lick slick flick prick
those close shows goes rose nose suppose propose expose oppose impose hose prose dispose
while style smile mile pile file isle tile vile
great state wait late date straight plate rate hate eight create debate mate gate fate freight
third heard word bird nerd absurd
last past fast cast blast vast mast
get let set bet net debt threat wet pet regret jet sweat vet gazette
well tell sell hotel fell bell personnel smell shell spell yell gel excel swell
long wrong song strong
about throughout doubt shout scout drought trout
support court short report sort sport fort import escort
now allow wow bow cow vow brow
live five drive survive arrive dive thrive strive revive derive hive
think link drink pink sink ink shrink blink zinc brink wink
made trade grade aid laid decade raid blade shade parade brigade fade persuade jade
course force source horse divorce endorse
end send spend tend trend bend blend lend
believe leave receive achieve sleeve relieve perceive retrieve weave
lot hot spot plot pot slot dot yacht knot rot watt
side provide wide ride decide guide hide pride slide divide tide abide
like strike bike spike hike
board record lord award afford sword reward accord chord
life wife knife
police release increase piece decrease cease niece grease
enough stuff tough rough buff bluff puff cuff
food include dude mood rude crude conclude exclude feud
event sent percent spent prevent rent extent intent accent bent cement descent dent invent
use produce reduce loose introduce juice goose moose induce truce
sure tour secure pure mature obscure endure lure
change range strange
perfect respect effect expect subject protect direct correct affect suspect select reflect connect collect
first worst burst thirst
turn learn concern burn earn stern
post coast host ghost toast roast boast
worth earth birth
road code mode load node explode
except kept accept swept intercept
boy enjoy destroy toy employ deploy soy
six fix mix
reach beach speech teach breach peach preach bleach
full pull bull wool
fact act cracked pact tract
plus thus bus discuss fuss
account amount discount
form warm storm dorm
check tech neck deck wreck trek spec
cut shut somewhat nut gut hut
size rise prize wise advise disguise despise
sense defense intense hence offense expense fence dense immense commence suspense
list exist assist twist resist insist wrist consist fist mist persist
sir transfer prefer occur refer fur entrepreneur stir spur blur
ask task mask
move improve approve groove
child wild mild
chief relief brief belief beef leaf grief thief reef
beyond bond respond blonde fond
club sub pub hub rub tub scrub dub
result adult cult insult consult
big dig pig fig gig rig wig
suit route cute fruit dispute boot recruit salute mute flute
group loop soup troop scoop
gone drawn dawn lawn pawn
work jerk clerk
farm arm harm charm
large charge barge
thought sought bot
young tongue lung
truth youth booth tooth
hope scope soap rope cope slope dope
shape escape tape grape
term firm worm
plant grant aunt rant chant
raise phase praise phrase gaze blaze maze
field shield yield
front hunt blunt stunt
worse nurse reverse diverse curse purse adverse
trust dust adjust bust thrust rust crust disgust
path math bath wrath
type pipe hype wipe ripe swipe stripe
lunch bunch punch crunch
felt belt melt
health wealth stealth
waste taste paste
miss kiss sis
step rep prep pep
east beast feast
tax relax wax axe fax
oil soil boil spoil foil coil
leg egg beg
fault salt halt vault
lost frost exhaust
girl pearl curl
camp stamp lamp champ ramp damp
self shelf elf
teeth beneath underneath
grab lab tab cab crab
rush brush crush flush blush lush
built guilt tilt
draft craft shaft
watch notch scotch
don con salon swan baton
gym swim slim trim rim limb grim dim hymn
exam ram jam dam ham spam slam lamb scam gram bam
paint complaint faint restraint
print hint sprint mint stint
flood mud bud stud
solve involve evolve
bug plug hug dug rug mug tug
attempt exempt contempt
punk trunk junk monk sunk funk chunk dunk
chef deaf ref
skull hull dull null
stretch sketch fetch
canal pal gal morale rationale
stem gem condemn
urge emerge surge verge purge
pause clause applause
inch pinch finch
globe probe robe
pork fork cork torque
drove stove cove
retire admire dire expire
superb curb verb disturb
corrupt interrupt disrupt
bolt revolt colt
fringe binge cringe
`,
multi: `
local total global mobile vocal focal
ocean motion notion devotion lotion potion
very cherry ferry berry merry scary dairy hairy prairie wary parry canary
money funny honey sunny bunny
better letter sweater setter
later paper greater creator elevator skater hater traitor translator dictator curator cater
power hour tower shower flower devour sour
able table cable stable label fable
action fraction faction traction
station nation location generation creation vacation relation sensation information education situation population
pocket rocket socket
winner dinner thinner beginner spinner skinner
jacket bracket packet racket
willing filling drilling chilling thrilling billing
rapper wrapper snapper
master faster disaster broadcaster plaster blaster pastor
already steady
crazy lazy daisy hazy
figure bigger rigor vigor trigger
mirror clearer nearer
struggle smuggle snuggle juggle
under wonder thunder blunder plunder
timing climbing rhyming
summer drummer newcomer plumber bummer
double trouble bubble rubble
follow hollow swallow Apollo
city pretty committee pity witty gritty kitty
danger stranger ranger changer
single mingle jingle
handle scandal candle
little middle riddle fiddle
spicy icy pricey
ticket cricket wicket picket
speaker weaker seeker sneaker
older shoulder holder folder colder bolder
butter cutter gutter clutter flutter stutter utter shutter
writer fighter lighter brighter tighter
cover lover
matter batter scatter chatter flatter shatter
talking walking hawking
tricky sticky picky
never ever clever lever endeavor
fire entire prior require desire wire hire acquire buyer liar
position addition competition commission condition definition tradition permission recognition transition
election section collection direction protection connection selection reflection inspection detection
together weather leather feather
season reason treason
production construction introduction reduction destruction instruction induction obstruction deduction
attention mention convention extension prevention intervention suspension invention dimension detention
million billion civilian trillion pavilion
specific scientific pacific terrific horrific prolific
potential essential presidential residential influential confidential differential existential
official initial artificial judicial beneficial superficial
decision division provision precision collision supervision revision
director sector inspector vector collector detector protector connector projector
solution distribution revolution constitution institution evolution contribution execution pollution prosecution
distance assistance resistance existence persistence insistence
story glory inventory quarry
journal internal external colonel eternal maternal
session depression expression impression profession succession progression discretion aggression confession
effective perspective objective collective detective respective protective selective prospective subjective
seven heaven eleven
science alliance compliance reliance defiance
expensive extensive offensive defensive comprehensive intensive
department apartment compartment
economic comic atomic
democratic dramatic automatic diplomatic static systematic problematic traumatic attic cinematic
measure pleasure treasure leisure
assistant consistent distant resistant persistent existent
quiet diet riot
question suggestion congestion
broken spoken token
final vinyl spinal
impressive progressive aggressive excessive successive oppressive obsessive expressive
fuel dual cruel renewal jewel
mental gentle dental rental continental
valley rally finale tally
factor actor tractor
taken bacon shaken
fantastic plastic enthusiastic drastic sarcastic elastic
professor lesser successor
present pleasant peasant
independent defendant superintendent attendant pendant
electronic chronic iconic sonic
trial denial dial
description subscription prescription encryption transcription inscription
exception reception perception conception inception deception interception
twitter bitter litter transmitter glitter hitter
tomorrow borrow sorrow
arrival survival revival
truly newly duly
metal settle kettle
fiction conviction jurisdiction prediction restriction friction depiction contradiction eviction
appearance interference clearance
occasion invasion equation evasion
genetic magnetic athletic pathetic aesthetic synthetic energetic cosmetic poetic kinetic
solar controller polar
conclusion confusion inclusion illusion exclusion collusion intrusion diffusion
dollar collar scholar
moral oral coral floral
giant client compliant reliant
forgotten cotton rotten
entry elementary complementary
worry hurry furry
gender surrender vendor contender slender
organic panic mechanic volcanic titanic
maker baker acre
delicious suspicious ambitious vicious malicious
artistic realistic characteristic optimistic linguistic mystic ballistic statistic
employment deployment enjoyment
replacement basement displacement
manner banner scanner planner
racial facial spatial
hockey rocky jockey
garden pardon harden
academic epidemic systemic pandemic
motor voter rotor
exclusive inclusive elusive
rural neural plural mural
productive destructive constructive
minor liner diner finer
grammar hammer glamour
spider rider cider
missile whistle dismissal
universal rehearsal reversal
outstanding misunderstanding notwithstanding
villa vanilla gorilla
enforcement endorsement reinforcement
random tandem memorandum
corruption disruption eruption
romantic gigantic semantic
assignment alignment confinement
narrow marrow sparrow
alcoholic symbolic metabolic
exotic patriotic chaotic aquatic antibiotic
explosion erosion corrosion
copper improper hopper
shooter tutor scooter
poker joker mediocre
idol tidal bridal
wizard lizard blizzard
merit inherit parrot
greedy speedy needy
meter liter eater
humble rumble stumble tumble
outrageous courageous contagious
explicit implicit illicit
dummy mummy yummy tummy
hazel nasal appraisal
bottle model throttle Aristotle coddle
party smarty hearty arty Bacardi
lucky ducky plucky Kentucky yucky
happy snappy scrappy sappy
nothing bluffing stuffing puffing roughing
freedom need_'em lead_'em feed_'em beat_'em
rhythm with_'em give_'em hit_'em
jealous zealous fellas tell_us
pillow willow billow armadillo
yellow fellow mellow hello cello
sorry Ferrari safari Atari calamari
planet granite Janet damn_it
rabbit habit grab_it have_it
magic tragic traffic
chicken kickin' stickin' pickin' thicken
coffee toffee off_me
water daughter hotter otter
bottom autumn Gotham got_'em
heavy Chevy levee bevy
golden holdin' foldin' olden beholden
silent violent tyrant
sister twister blister mister whisper
buckle chuckle knuckle
giggle wiggle jiggle squiggle
busy dizzy fizzy frizzy
messy dressy Jessie
lady shady Brady Grady
cozy rosy nosy
fancy Nancy chancy
travel gravel unravel
brother mother other another smother
button mutton glutton nothin'
written kitten mitten smitten bitten
hidden forbidden ridden kiddin'
chosen frozen closin' posin' dozin'
fashion passion crashin' cashin' smashin' clashin'
nervous service purpose surface
focus hocus_pocus locus bogus
lightning frightening tightening brightening
moment opponent component exponent proponent
purple turtle hurdle girdle fertile
crystal pistol Bristol
simple dimple pimple
sizzle drizzle fizzle chisel
dragon wagon draggin' braggin' saggin'
funky monkey chunky spunky flunky
turkey jerky murky perky quirky
apple chapel grapple dapple
quicker thicker sticker kicker slicker liquor
flavor favor savior labor neighbor
hero zero Nero De_Niro
tiny shiny whiny
pony phony bony Tony baloney macaroni
sleepy creepy weepy
legal eagle regal beagle illegal
castle hassle tassel
battle rattle cattle Seattle saddle
`,
toolkit: `
ship trip flip grip whip sip drip
child wild filed mild compiled styled
complex checks flex decks specs
cars stars bars Mars scars guitars
like strike bike spike hike mic
new through true due view crew debut brew
designed grind refined aligned mastermind rewind
show although below pro flow glow dough
type pipe hype ripe swipe stripe
across loss boss sauce floss
about out doubt shout scout drought clout
thing king ring swing sting bling
back attack track stack plaque
worse nurse verse purse
lunch bunch punch crunch brunch
skills bills hills drills chills thrills
those shows goes knows rose suppose flows expose pros compose
respect effect protect direct select reflect connect collect
hit split admit quit commit lit legit spit
move improve approve groove
hope scope rope cope slope
camp stamp lamp champ ramp
campaign brain gain chain domain reign champagne
street complete beat heat defeat elite
told hold gold cold bold
game name claim aim fame flame
line design divine shine
cash flash splash stash
down town brown crown clown
cypher hyper viper sniper wiper
hook book look took cook crook
beef chief thief grief brief
diss miss this kiss bliss abyss
opps guap drop top stop shop props
homie show_me know_me owe_me slowly
hood good stood could would wood
gang slang hang rang sang fang
swag brag bag flag drag tag
fire higher buyer liar wire entire
banger hanger anger
rhyme time dime prime climb crime
scheme team dream stream extreme
legend second reckoned beckoned
throne zone own known stone grown
cheddar better letter sweater wetter
bread head said spread fed thread
bands hands stands fans plans grands
real deal feel steal wheel
fake snake break take make shake
rep step prep pep
diamond rhymin' climbin' timin' shinin'
sample example ample trample
loop group hoop troop coop
scratch match catch patch batch
crowd loud proud cloud allowed vowed
stage page cage age wage engage
encore floor more before score
charts hearts parts starts smarts
feature creature teacher preacher bleacher
producer juicer loser user reducer
ice price nice twice dice slice
`,
office: `
get_it said_it credit bet_it regret_it edit
own known phone zone loan tone
thank bank frank tank rank blank
check tech deck spec
print hint sprint mint
back track stack hack Slack
joy employ convoy deploy annoy
meeting competing completing repeating greeting deleting
judge_it budget fudge_it
day pay okay display delay replay
great state wait late rate create update debate
best test request impressed invest
ask task mask
ship_it clip_it skip_it flip_it grip_it zip_it
gap snap wrap recap roadmap
team dream stream theme extreme scheme esteem redeem
whole control role goal soul console payroll
set bet net debt threat regret
produced introduced reduced boost
one_day fun_day Sunday Monday
hip-hop laptop workshop desktop rooftop nonstop
all_night highlight insight spotlight upright
complete repeat compete retreat receipt upbeat spreadsheet
rich switch pitch twitch glitch
more before floor score core explore
cash crash flash dash stash
`,
// themed lists: each pack rhymes, and leads with its most on-theme words
gaming: `
game frame aim fame name same flame blame
clutch much touch such crutch Dutch
lobby hobby Bobby snobby
respawn dawn gone upon drawn lawn
loot shoot boot route recruit mute suit
noob tube cube YouTube
ranked thanked banked tanked yanked pranked
quest chest best test rest west dressed
lag tag bag brag drag flag
squad nod odd flawed applaud facade
camp champ stamp ramp lamp
controller roller stroller bowler solar polar
console control goal soul roll stroll hole
streamer dreamer screamer schemer redeemer steamer
pixel nickel tickle pickle fickle sickle
grind mind find behind blind rewind
skin win spin begin in thin
perk work jerk smirk quirk lurk
nerf surf turf smurf
buff stuff rough tough enough puff
raid played made blade fade stayed
guild build skilled filled chilled killed
clan plan fan man can scan
dungeon plungin' onion bunion
mouse house spouse blouse
ping king ring thing swing wing
queue crew through view new true
zone throne phone bone own known
drop top stop pop shop hop
heal feel real deal steal wheel
tank bank prank plank thank blank
sniper viper hyper wiper diaper piper
gamer tamer framer lamer claimer
stealth health wealth self
ammo camo Rambo
crit hit quit split legit lit
rage stage cage page age wage
emote quote vote boat note float
patch match catch batch snatch hatch
carry scary very merry hairy
`,
slang: `
rizz fizz quiz whiz biz his
cap snap slap trap rap clap map nap
mid kid did hid lid squid skid
slay okay play day they pray
ratio radio patio rodeo
aura Laura flora Nora Dora
glazing amazing blazing praising raising grazing
delulu Honolulu Zulu Lulu
sus bus plus fuss us
vibe tribe bribe scribe describe
goat note quote boat vote wrote
ick sick quick pick trick slick
simp shrimp limp blimp
stan fan plan man can
ghosted posted hosted boasted toasted roasted coasted
sheesh leash quiche unleash
yeet feet heat beat sweet street
bet set net debt threat sweat
lowkey smoky hokey pokey
cringe unhinged binge fringe hinge
based chased faced laced paced taste
sigma stigma enigma
mog dog fog log frog jog
valid salad ballad
tea free see degree three key
shook cooked book look took hook
lore more score floor core pour
yapping rapping clapping snapping tapping napping
chat that flat hat cat
ate great late eight straight weight
vibing driving thriving striving
scrolling trolling rolling bowling strolling controlling
meme team dream stream scheme
viral spiral rival tribal
lit fit hit bit split quit
bussin' cussin' fussin' discussin'
iconic chronic sonic tonic bionic
`,
food: `
tacos nachos ponchos
ramen almond common salmon
waffle awful falafel
pizza Lisa visa Ibiza Teresa
burger merger Gerber
fries size rise prize eyes wise
steak cake shake bake make take
rice spice nice price ice twice
bread said head fed red spread
cheese please breeze keys ease trees
toast roast most post coast ghost
wings things kings rings swings
noodle strudel doodle poodle
curry hurry worry blurry flurry
honey money funny sunny
cookie rookie bookie
pickle tickle nickel fickle
cherry berry dairy very merry scary
mango tango Durango
melon felon Helen Ellen
potato tomato Plato
gravy wavy navy Davy
candy handy dandy brandy sandy
chips dips trips flips lips ships
fish dish wish swish
snack back track stack crack attack
munch lunch brunch crunch bunch punch
sauce boss loss toss cross
grill chill skill thrill still
feast beast least east yeast
spicy icy pricey dicey
bacon taken shaken makin' breakin'
smoothie movie groovy moody
soup scoop group loop hoop troop
juice loose goose truce produce
pie fry high fly sky try
jelly deli belly smelly
beef chief grief brief leaf thief
meat treat eat sweet beat heat
wrap snap trap rap map
`,
sports: `
dunk funk junk trunk punk
goal bowl roll soul control hole
score more floor door core
ball call fall wall all hall
shot hot spot got lot plot
net set bet sweat threat
court sport short report support
field shield yield sealed healed
coach approach roach poach
team dream scheme stream extreme
win spin begin grin in
slam jam exam scam ram
pitch switch rich ditch hitch
swing ring king bring thing
strike spike like bike hike
race base chase face place space
track sack back attack stack
pass grass class glass mass
block clock rock shock knock
defense fence intense sense tense
tackle shackle crackle cackle
hustle muscle tussle bustle
fumble rumble humble stumble tumble
rebound sound ground found around
sprint hint print mint
medal pedal metal settle
league fatigue intrigue
foul howl growl owl prowl
serve curve swerve nerve deserve
bench French trench wrench drench
draft craft laughed shaft
kick quick stick trick pick slick
punt hunt stunt front blunt
lap snap gap clap trap
`,
// name packs (common first names, plus a few nicknames): a leading * marks the name. A pack comes up when that name is
// on a team roster (or is a team name), or for everyone when the "Every name pack" switch is on.
people: `
*Aaron wearin' sharin' apparent carin' darin'
*Abigail fail mail nail jail scale whale
*Adam atom madam had_'em add_'em grab_'em at_'em
*Addison had_this_in add_this_in medicine packed_this_in
*Aiden fadin' tradin' raidin' maiden waitin' laden
*Alex balance palace Dallas chalice
*Alexander commander slander bystander salamander candor
*Amanda panda propaganda veranda can_the
*Amber chamber clamber hamper camper pamper scamper
*Amelia feel_ya heal_ya steal_ya Cecilia
*Amy blame_me name_me tame_me shame_me claim_me
*Andrew brand_new can_do and_you plan_to man_too
*Andy candy handy dandy sandy brandy
*Angela can_tell_a and_tell_a handle_a cancel_a
*Aniket set bet net threat jet sweat
*Anna banana Havana Montana can_a nirvana
*Anthony family canopy symphony Tiffany epiphany
*Arvin parkin' starvin' Marvin carvin'
*Asher smasher crasher slasher dasher thrasher faster master
*Ashley flashy trashy rashly classy
*Aswin within begin spin grin
*Ava save_ya made_ya lava java
*Avery bravery savory favor_me save_for_me
*Barbara barber harbor larva Sahara
*Becky sketchy techy check_me wreck_me
*Ben ten when then again pen men
*Benjamin Benjamins then_again ten_of_them when_I'm_in
*Bennett when_it senate tenant pennant
*Beth breath depth Macbeth Seth
*Betty spaghetti confetti petty sweaty ready Yeti
*Brandon standin' landin' expandin' abandon commandin'
*Brenda agenda blender vendor lender pretender
*Brian lion iron cryin' flyin' tryin' Zion
*Cameron camera_on glamorous hammerin' stammerin'
*Carol barrel apparel peril feral sterile
*Carolyn very_thin terror_in carry_him bury_him
*Catherine flatterin' gatherin' rather_in scatterin'
*Charles marbles snarls stars cars bars
*Charlotte scarlet car_lot starlet target market
*Chloe slowly show_me know_me snowy throw_me
*Chris this miss diss bliss abyss hiss
*Christina arena subpoena Athena ballerina between_a
*Christine clean machine routine scene green sixteen
*Christopher whisper sister Mister twister blister
*Cynthia with_ya win_the in_the begin_the
*Dan plan can fan man scan began
*Daniel manual annual spaniel channel panel flannel
*Darren sharin' parent carin' darin' barren
*Dave wave save brave cave rave behave
*David saved_it made_it played_it paid_it gave_it
*Deborah zebra better ever never
*Debra zebra never whatever ever
*Dennis menace tennis Venice Guinness finish
*Diane plan can fan began Japan scan
*Donald McDonald's modeled bottled throttled coddled
*Donna gonna wanna Madonna piranha honor
*Dorothy priority majority authority sorority
*Douglas struggles juggles snuggles troubles
*Dylan villain chillin' killin' million billion willin' spillin'
*Edward red_bird said_word head_first next_word best_word
*Elijah inspire_ya hire_ya fire_ya deny_ya higher
*Eliza wiser visor riser appetizer
*Elizabeth breath depth Macbeth Seth
*Ella fella Stella umbrella tell_a sell_a propeller
*Emily memory enemy remedy melody
*Emma dilemma henna Vienna them_a
*Eric generic hysteric cleric numeric America
*Ethan breathin' beatin' eatin' even freedom
*Evelyn devil_in level_in revel_in rebel_in seven_in
*Frank bank tank thank rank prank blank
*Fred said head instead spread shred
*Gary scary very carry berry hairy legendary
*Gavin havin' travelin' javelin unravelin'
*George forge gorge large charge barge
*Grace face place race space chase case
*Greg leg beg egg keg nutmeg peg
*Gregory legacy memory weaponry category
*Hannah banana Savannah Havana Montana can_a
*Harper sharper darker starter marker
*Heather weather leather together feather tether forever
*Helen tellin' sellin' yellin' melon felon swellin'
*Henry century plenty entry sentry
*Hirad squad nod odd fraud abroad facade applaud
*Huimin gamin' claimin' aimin' namin' framin'
*Hyeontae one_day fun_day Sunday Monday runway
*Isabella umbrella fella Cinderella cellar a_capella
*Jack back track black attack stack snack
*Jackson action traction fraction taxin' relaxin' faction
*Jacob make_up take_up wake_up shake_up
*James games names flames claims frames aims
*Janet planet granite can_it plan_it ran_it
*Jason chasin' racin' facin' basin placin' amazin'
*Jayden fadin' tradin' maiden playin' sayin'
*Jeff chef ref left deaf breath
*Jeffrey referee left_me freshly hefty
*Jen when then again men pen den yen
*Jennifer venture sinister minister defender
*Jerry cherry very scary merry berry ferry
*Jess mess stress dress press chess success
*Jessica mess_of_a best_of_a less_of_a test_of_a
*Jim gym him slim swim grim trim
*Joan own phone known alone zone throne
*Joe go show flow know glow pro
*John on gone dawn con lawn upon drawn
*Jon on gone dawn con upon drawn
*Jonathan marathon on_and_on Amazon Babylon
*Jose okay today away display ballet holiday
*Joseph close_up dose_of most_of host_of ghost_of
*Josh gosh wash squash posh slosh
*Joshua watch_you got_you caught_you bought_you taught_you
*Joyce voice choice noise Royce rejoice toys
*Julie truly newly unruly do_me
*Justin trust_in bustin' adjustin' discussin'
*Karen starin' sharin' carin' wearin' darin' comparin'
*Kate great late wait date straight plate
*Katelyn waitin' skatin' hatin' datin' makin' takin'
*Katherine gatherin' batterin' flatterin' shatterin' scatterin'
*Kathleen caffeine gasoline magazine trampoline
*Katie lately greatly eighty shady weighty
*Kelly belly jelly smelly deli tell_me sell_me
*Kenneth when_it then_it send_it spend_it tenth
*Kevin seven heaven eleven Devon
*Kim slim gym swim trim him whim
*Kimberly nimbly simply assembly trembly
*Kwan on gone dawn swan
*Kyle style smile while mile pile file aisle
*Larry scary very carry dairy legendary canary
*Laura aura flora Dora Bora_Bora explorer
*Lauren pourin' scorin' borin' snorin' foreign explorin'
*Liam see_'em free_'em museum coliseum need_'em
*Lina arena Argentina Athena ballerina
*Linda win_the spin_the in_the window begin_the
*Lisa pizza Visa Ibiza teaser piece_of
*Liz quiz fizz biz whiz showbiz his
*Logan slogan token frozen open chosen
*Lucas mucus juke_us nuke_us shook_us took_us
*Lucy juicy loosely Gucci bougie
*Madeline saddle_in battlin' rattlin' paddlin'
*Madison add_this_in had_this_in medicine packed_this_in
*Margaret target market carpet starlet
*Maria idea see_ya Korea pizzeria
*Mark dark park spark shark bark remark
*Mary very scary carry fairy berry legendary
*Mason basin chasin' facin' racin' wastin' tastin'
*Matt that chat flat hat combat format
*Matthew at_you that_you had_you bad_news grab_you
*Meg egg leg beg peg keg
*Meher hair care there chair stare share flair unfair nightmare millionaire
*Melissa miss_ya diss_ya kiss_ya this_a listen
*Mia idea see_ya Korea free_ya
*Michael cycle recycle bicycle viral spiral vital
*Michelle well tell sell shell spell bell
*Mike mic like bike strike spike Nike
*Nancy fancy antsy can't_see dance_free
*Nathan waitin' hatin' patient creatin' playin'
*Nicholas ridiculous meticulous tickle_us pickle_us
*Nick quick click kick trick brick slick
*Nicole soul goal roll control whole patrol
*Noah know_ya show_ya throw_ya boa Iowa
*Noj road code showed mode load owed
*Olivia trivia Bolivia give_ya oblivion
*Pamela camera hammer_a slammer stammer
*Patricia wish_ya miss_ya diss_ya fishin' delicious
*Patrick hat_trick that_trick magic tragic matrix
*Paul all call small ball wall tall
*Pete beat heat street sweet elite defeat
*Peter heater meter cheetah leader beater
*Pia idea see_ya Maria Mamma_Mia pizzeria
*Piyush push ambush whoosh swoosh
*Rachel facial spatial basil glacial
*Ray day play say stay okay today
*Raymond payment statement basement placement
*Rebecca Mecca wreck_a check_a deck_a
*Richard picture pitcher richer switch_it ditch_it
*Rob job mob snob slob knob sob
*Robert mobster lobster monster concert got_hurt
*Rohan gone drawn dawn lawn pawn yawn
*Ronald McDonald's modeled toddled wobbled
*Ryan lion iron cryin' flyin' tryin' denyin'
*Sam jam slam scam exam Instagram program
*Samantha panther answer dancer Atlanta Santa
*Samuel manual annual camel mammal handle
*Sandra panda candor scandal sandal and_the
*Sarah era error terror mascara Sahara
*Scott hot got lot shot spot plot
*Shannon cannon abandon canyon
*Sharon sharin' starin' wearin' carin' barren
*Shirley surely early curly burly pearly
*Sofia idea see_ya Korea Maria
*Sophia idea see_ya free_ya Korea pizzeria
*Stephanie felony epiphany symphony Tiffany deafen_me
*Stephen even leavin' believin' achievin' sneezin'
*Steve believe leave sleeve achieve weave
*Steven even leavin' believin' achievin' breathin' grievin'
*Susan losin' choosin' cruisin' bruisin' snoozin' amusin'
*Thomas promise honest Bahamas pajamas
*Tigran Lebron electron python proton Teflon
*Tim him whim rim slim swim grim
*Timothy sympathy hit_me with_me pity city
*Tom bomb calm palm mom prom
*Tony only testimony pony macaroni
*Tyler compiler styler dialer smiler
*Victoria euphoria Gloria Astoria for_ya
*Wendy trendy spendy send_me lend_me bendy friendly
*Wenzheng hang gang bang dang mustang slang boomerang
*Will skill chill still thrill bill spill
*William million billion brilliant villain civilian chillin'
*Xiang long wrong song strong gong
*Zach back attack snack track stack crack
*Zachary battery flattery factory gallery salary
*Zhen when then again ten Zen
*Zhenhua Iowa Ottawa Nicaragua
`,
// streamer packs: tags of the most-followed Twitch streamers, plus a few favorites. They work like name packs: a tag only
// comes up when that streamer is on a team (or for everyone when "Every name pack" is on).
streamers: `
*KaiCenat that flat chat combat format acrobat
*Ibai bye sky fly high why goodbye
*Ninja in_ya win_ya spin_ya begin_ya
*Auronplay play okay display replay today away
*Rubius dubious studious Julius ludicrous
*xQc excuse_me rescue_me free degree guarantee
*EasyLiker biker hiker striker I_like_her
*TheGrefg chef ref left clef
*Juansguarnizo chorizo Ibiza pizza Mona_Lisa
*Tfue few view crew true through review
*Shroud loud crowd proud cloud allowed vowed
*Jynxzi Helsinki pinky slinky think_he
*ElMariana banana Montana Havana Nirvana bandana
*Edu90 mighty nightly tightly slightly almighty
*ElSpreen green clean screen machine routine between
*Pokimane main game chain insane campaign champagne
*Sodapoppin stoppin' droppin' shoppin' hip-hoppin' non-stoppin'
*caseoh ratio patio radio rodeo say_so
*Clix fix mix tricks kicks six picks
*Alanzoka mocha polka Toyota quota
*TimTheTatman plan fan can van began Pac-Man
*Myth with Smith fifth gift
*Tommyinnit in_it win_it minute spin_it limit
*SypherPK okay play today away display
*Coringa bring_a sing_a swing_a ring_a
*Mongraal all ball call fall wall
*AriGameplays plays days ways praise blaze craze
*RiversGG free me see degree three key
*AdinRoss boss loss cross toss floss sauce
*NICKMERCS works perks jerks quirks lurks
*Quackity capacity audacity tenacity back_to_me
*Summit1g me free tree spree guarantee
*Amouranth amaranth plant chant can't slant
*Dream team scheme stream seem extreme supreme
*Moistcr1tikal critical political cynical typical pinnacle
*Robleis phase maze gaze haze raise
*Squeezie easy breezy cheesy queasy
*NickEh30 dirty flirty nerdy early wordy
*MontanaBlack88 great late straight state wait
*Elded welded melted belted pelted
*Loltyler1 run done fun won none
*Bugha tuba scuba Cuba Aruba
*IShowSpeed need lead bleed indeed succeed stampede
*Tubbo jumbo gumbo Dumbo Columbo
*stableronaldo Waldo tornado avocado Toledo
*Ludwig big gig dig rig twig swig jig
*Atrioc rock clock block shock stock knock deadlock
`
};
const bare = w => w.replace(/^\*/, '');
const parseFams = txt => txt.trim().split('\n').map(l => l.trim().split(/\s+/).map(w => w.replace(/_/g, ' '))).filter(f => f.length >= 2);
function syllables(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}
// name packs, streamer tags included
const PEOPLE_FAMS = [...parseFams(RAW.people), ...parseFams(RAW.streamers)];
const PEOPLE = new Set(PEOPLE_FAMS);
const LISTS = (() => {
  const basic = parseFams(RAW.basic), toolkit = parseFams(RAW.toolkit);
  const one = [];
  const seen = new Set();
  for (const f of [...basic, ...toolkit]) {
    const k = f.filter(w => !w.includes(' ') && !w.includes('-') && syllables(w) === 1 && !seen.has(w));
    k.forEach(w => seen.add(w));
    if (k.length >= 3) one.push(k);
  }
  return {
    basic: { name: 'Everyday', blurb: 'Common words everyone knows. The best place to start.', fams: basic },
    one: { name: 'One-syllable', blurb: 'Short and punchy, like cash, flash, stash. Easiest to land on the beat.', fams: one },
    multi: { name: 'Two-syllable', blurb: 'Multis like motion / ocean / notion. Harder to fit, sounds better.', fams: parseFams(RAW.multi) },
    toolkit: { name: "Rapper's toolkit", blurb: 'Bars, flex, drip, clout. Hip-hop vocabulary.', fams: toolkit },
    office: { name: 'Office hours', blurb: 'Credit, sprints, Slack, payroll. Bars about the day job.', fams: parseFams(RAW.office) },
    gaming: { name: 'Gaming', blurb: 'Clutch, respawn, loot, lobby. Bars for the squad chat.', fams: parseFams(RAW.gaming) },
    slang: { name: 'Internet slang', blurb: 'Rizz, cap, aura, delulu. Words from the group chat.', fams: parseFams(RAW.slang) },
    food: { name: 'Food', blurb: 'Tacos, ramen, waffles, wings. Bars you can taste.', fams: parseFams(RAW.food) },
    sports: { name: 'Sports', blurb: 'Dunk, tackle, rebound, fumble. Bars from the arena.', fams: parseFams(RAW.sports) },
    namedrop: { name: 'Name drop', blurb: 'A name pack for each rapper on your teams (streamers get their tag), plus every Everyday pack and the best of the rest.', fams: (() => {
      // easy, high-energy packs borrowed from the smaller lists (found by a word they contain)
      const BEST = { multi: ['money', 'paper', 'nation', 'power'], toolkit: ['drip', 'flex', 'bars', 'mic', 'respect', 'legit'], office: ['deploy', 'meeting', 'laptop', 'spreadsheet', 'Slack'] };
      const best = Object.entries(BEST).flatMap(([k, ws]) => { const fams = parseFams(RAW[k]); return ws.map(w => fams.find(f => f.map(bare).includes(w))).filter(Boolean); });
      const seen = new Set(), out = [];
      for (const f of [...PEOPLE_FAMS, ...basic, ...best]) { const k = f.map(w => bare(w).toLowerCase()).sort().join('|'); if (!seen.has(k)) { seen.add(k); out.push(f); } }
      return out;
    })() },
  };
})();
// names currently on a team: each rapper's first word and whole name run together ("Kai Cenat" matches the KaiCenat tag),
// plus the team names themselves
function rosterNames() {
  const s = new Set();
  const add = n => { n = (n || '').trim().toLowerCase(); if (!n) return; s.add(n.split(/\s+/)[0]); s.add(n.replace(/[\s._'’-]+/g, '')); };
  try {
    for (const m of CFG.lineup) add(m.name);
    if (s.has('jennifer')) s.add('jen');
    for (const t of CFG.teams) add(t.name);
  } catch { }
  return s;
}
// the "Every name pack" switch (CFG.allNames) turns on everyone's pack, not just the rappers on the teams;
// Turn on in the word browser (CFG.enabledNames) does it for one name
const allNamesOn = () => { try { return !!CFG.allNames; } catch { return false; } };
const handNames = () => { try { return new Set(CFG.enabledNames); } catch { return new Set(); } };
const personActive = (f, names = rosterNames(), hand = handNames()) => { const k = bare(f[0]).toLowerCase(); return allNamesOn() || names.has(k) || hand.has(k); };
// the families a list draws from right now (Name drop leaves out name packs for anyone not on a team)
// what the viewer switched off in the word browser: words (off in every list) and whole packs
const famKey = f => f.map(w => bare(w).toLowerCase()).sort().join('|');
function switchedOff() {
  try { return { words: new Set(CFG.disabledWords), packs: new Set(CFG.disabledPacks) }; }
  catch { return { words: new Set(), packs: new Set() }; }
}
const packOff = (f, off) => off.packs.has(famKey(f)) || (f[0][0] === '*' && off.words.has(bare(f[0]).toLowerCase()));
function activeFams(listId) {
  const l = LISTS[listId] || LISTS.basic;
  const names = listId === 'namedrop' ? rosterNames() : null, hand = handNames();
  const off = switchedOff(), out = [];
  for (const f of l.fams) {
    if (names && PEOPLE.has(f) && !personActive(f, names, hand)) continue;
    if (packOff(f, off)) continue;
    const kept = off.words.size ? f.filter(w => !off.words.has(bare(w).toLowerCase())) : f;
    if (kept.length >= 2) out.push(kept);
  }
  return out;
}

/* ================= rhyme schemes =================
   4 rows (bars) x 4 pads (beats). Letters mark rhyme groups. */
const SCHEMES = [
  { id: 'AABB', name: 'AABB', desc: 'Couplets. Each pair of bars rhymes.', rows: ['___A', '___A', '___B', '___B'], dbl: ['_A_A', '_B_B', '_C_C', '_D_D'] },
  { id: 'AAAA', name: 'AAAA', desc: 'One sound for four bars straight.', rows: ['___A', '___A', '___A', '___A'], dbl: ['_A_A', '_A_A', '_B_B', '_B_B'] },
  { id: 'ABAB', name: 'ABAB', desc: 'Two sounds that take turns.', rows: ['___A', '___B', '___A', '___B'], dbl: ['_A_B', '_A_B', '_C_D', '_C_D'] },
  { id: 'AAXA', name: 'AA·A', desc: 'Rhyme, rhyme, breathe, rhyme.', rows: ['___A', '___A', '____', '___A'], dbl: ['_A_A', '___A', '_B_B', '___B'] },
];
const REVEALS = [
  { id: 'all', name: 'All words' },
  { id: 'first', name: 'First only' },
  { id: 'last', name: 'Last only' },
  { id: 'none', name: 'No words' },
];
const PALETTE = ['#ff7a3d', '#3fb8f0', '#ffd23a', '#4fdc8f', '#c286ff', '#ff5f8f'];

/* ---- word memory: every word shown in a battle is remembered on this device, so later battles get fresh ones ---- */
const USED_KEY = 'bfb.usedWords';
const USED = new Set(ls.get(USED_KEY, []));
const wkey = w => bare(w).toLowerCase();
function saveUsed() { ls.set(USED_KEY, [...USED].slice(-12000)); }
function forgetUsed() { USED.clear(); saveUsed(); }
// fresh (never shown) words left in a list right now; names always show, so they don't count
function freshLeft(listId) {
  const s = new Set();
  for (const f of activeFams(listId)) for (const w of f) if (w[0] !== '*' && !USED.has(wkey(w))) s.add(wkey(w));
  return s.size;
}
// names (and streamer tags) can repeat, so the word memory leaves them out
const PERSON_NAMES = new Set(PEOPLE_FAMS.map(f => bare(f[0]).toLowerCase()));
// opts.rng: random source (default Math.random). opts.used: the set of shown words to steer away from (default: this device's
// memory). An online battle passes a seeded rng and a fresh set, so every device draws the same words.
function makeWordGen(listId, schemeId, dbl, reveal, track = false, opts = {}) {
  const rnd = opts.rng || Math.random, used = opts.used || USED;
  let fams = activeFams(LISTS[listId] ? listId : 'basic');
  if (!fams.length) fams = (LISTS[listId] || LISTS.basic).fams.map(f => f.filter(w => w[0] !== '*'));
  const scheme = SCHEMES.find(s => s.id === schemeId) || SCHEMES[0];
  const rows = dbl ? scheme.dbl : scheme.rows;
  const recent = [];
  let color = 0;
  const cap = Math.max(4, Math.floor(fams.length * 0.6));
  const anchorsOf = f => f.filter(w => w[0] === '*').length;
  const fresh = f => f.reduce((c, w) => c + (w[0] !== '*' && !used.has(wkey(w)) ? 1 : 0), 0);
  const roster = rosterNames(); for (const k of handNames()) roster.add(k);
  function pick(n, avoid) {
    const ok = f => f.length >= n && !f.some(w => avoid.has(wkey(w)));
    const rs = new Set(recent);
    let cands = fams.filter(f => ok(f) && !rs.has(f));
    if (!cands.length) { recent.length = 0; cands = fams.filter(ok); }
    if (!cands.length) cands = fams;
    // packs with enough fresh words win; the names of rappers on the teams (and names turned on by hand) come up 3x as
    // often, while packs switched on for everyone come up like any other pack; name packs may reuse partner words
    const wt = cands.map(f => { const ok = fresh(f) >= n - Math.min(n, anchorsOf(f)), named = f[0][0] === '*';
      const big = named && roster.has(wkey(f[0]));
      return (big ? 3 : 1) * (ok ? 1 : named ? 0.2 : 0.002); });
    let r = rnd() * wt.reduce((a, b) => a + b, 0), k = 0;
    while (k < cands.length - 1 && (r -= wt[k]) > 0) k++;
    const f = cands[k];
    recent.push(f); if (recent.length > cap) recent.shift();
    return f;
  }
  return function block() {
    const out = rows.map(() => [null, null, null, null]);
    const groups = {};
    rows.forEach((s, ri) => [...s].forEach((ch, ci) => { if (ch !== '_') (groups[ch] ||= []).push([ri, ci]); }));
    const avoid = new Set();   // two rhyme groups on one block never share a sound
    for (const g of Object.keys(groups).sort()) {
      const slots = groups[g];
      const fam = pick(slots.length, avoid);
      fam.forEach(w => avoid.add(wkey(w)));
      // packs list their most common words first; lean toward those so prompts stay easy to use. Unused words go first.
      const anchors = fam.filter(w => w[0] === '*').slice(0, slots.length);
      const rest = fam.filter(w => w[0] !== '*');
      const unused = rest.filter(w => !used.has(wkey(w)));
      // only fall back to already-used words when this pack has too few fresh ones
      const pool = unused.length >= slots.length - anchors.length ? unused : [...unused, ...rest.filter(w => used.has(wkey(w)))], chosen = [];
      while (anchors.length + chosen.length < slots.length && pool.length) {
        let tot = 0; const wts = pool.map((_, i) => (tot += Math.pow(0.72, i), Math.pow(0.72, i)));
        let r = rnd() * tot, k = 0; while (k < pool.length - 1 && (r -= wts[k]) > 0) k++;
        chosen.push(pool.splice(k, 1)[0]);
      }
      const words = shuffle([...anchors, ...chosen], rnd).map(bare);
      const c = (color++ % 6) + 1;
      slots.forEach(([ri, ci], i) => {
        const show = reveal === 'all' || (reveal === 'first' && i === 0) || (reveal === 'last' && i === slots.length - 1);
        out[ri][ci] = { w: words[i % words.length], c, show };
        // remember every shown word except names, which can come back
        if (track && show && !PERSON_NAMES.has(words[i % words.length].toLowerCase())) used.add(words[i % words.length].toLowerCase());
      });
    }
    if (track && used === USED) saveUsed();
    return out;
  };
}

/* ================= built-in beats =================
   Step patterns: x=1, X=1.2, o=.65, -=.35, .=rest. Notes: [step, midi|chord[], lenSteps, vel, glideFrom] */
const PRESETS = [
  {
    id: 'basement', name: 'Basement Tapes', style: 'Boom bap', bpm: 90, swing: 0.58, steps: 16, color: '#ff7a3d', crackle: 0.5,
    mix: { kick: 1, snare: .95, hat: .55, bass: .9, keys: 1 },
    kick: ['x......x..x.....', 'x.x.......x..o..', 'x......x..x.....', 'x.x.......x.....'],
    snare: ['....x.......x...', '....x.......x..-', '....x.......x...', '....x..-....x...'],
    hat: ['x.o.x.o.x.o.x.o.'],
    ohat: ['................', '................', '................', '..............o.'],
    bass: [
      [[0, 33, 6], [7, 33, 3], [10, 36, 4]],
      [[0, 29, 2], [2, 29, 7], [10, 33, 3], [13, 31, 2]],
      [[0, 38, 6], [7, 38, 3], [10, 36, 4]],
      [[0, 28, 2], [2, 40, 6], [10, 28, 3], [13, 35, 2]],
    ],
    keys: [
      [[0, [57, 60, 64, 67, 71], 5, .9], [6, [57, 60, 64, 67, 71], 3, .5], [10, [57, 60, 64, 67, 71], 6, .7]],
      [[0, [53, 57, 60, 64, 67], 5, .9], [6, [53, 57, 60, 64, 67], 3, .5], [10, [53, 57, 60, 64, 67], 6, .7]],
      [[0, [50, 53, 57, 60, 64], 5, .9], [6, [50, 53, 57, 60, 64], 3, .5], [10, [50, 53, 57, 60, 64], 6, .7]],
      [[0, [52, 56, 62, 67], 5, .9], [6, [52, 56, 62, 67], 3, .5], [10, [52, 56, 62, 67], 6, .7]],
    ],
    keysCut: 2300,
  },
  {
    id: 'nightshift', name: 'Night Shift', style: 'Trap', bpm: 70, swing: 0.5, steps: 32, color: '#c286ff',
    mix: { kick: .55, snare: 1, hat: .5, sub: 1, bell: 1, pad: 1 },
    kick: ['x......x..x.......x...x.........', 'x......x..x.....x.....x...x.x...'],
    clap: ['........x...............x.......', '........x...............x.....-.'],
    hat: ['x.o.x.o.x.o.x.o.x.o.x.o.xooo-.o.', 'x.o.x.o.xoo.x.o.x.o.x.o.x.o.oooo'],
    hatMetal: true,
    sub: [
      [[0, 29, 7], [7, 29, 3], [10, 32, 8], [18, 29, 4], [22, 27, 10]],
      [[0, 25, 7], [7, 25, 3], [10, 27, 6], [16, 29, 6], [22, 29, 4], [26, 32, 2], [28, 36, 4, 1, 32]],
    ],
    bell: [
      [[0, 72, 4, .9], [4, 68, 4, .6], [8, 65, 4, .7], [12, 68, 4, .6], [16, 72, 4, .8], [20, 75, 4, .6], [24, 72, 4, .7], [28, 68, 4, .6]],
      [[0, 73, 4, .9], [4, 68, 4, .6], [8, 65, 4, .7], [12, 68, 4, .6], [16, 73, 4, .8], [20, 77, 4, .6], [24, 75, 4, .7], [28, 72, 4, .6]],
    ],
    pad: [[[0, [53, 56, 60], 32, .8]], [[0, [49, 53, 56], 32, .8]]],
  },
  {
    id: 'sunset', name: 'Sunset Cruise', style: 'West coast', bpm: 94, swing: 0.55, steps: 16, color: '#ffd23a',
    mix: { kick: 1, snare: .8, clap: .8, hat: .45, fbass: 1, lead: 1, keys: .8 },
    kick: ['x.....x...x.....', 'x.....x.x.......'],
    snare: ['....x.......x...'],
    clap: ['....x.......x...'],
    hat: ['xoxoxoxoxoxoxoxo'],
    ohat: ['................', '..............o.'],
    fbass: [
      [[0, 31, 3], [3, 43, 1, .7], [6, 31, 2], [8, 34, 2], [10, 36, 2], [14, 38, 2]],
      [[0, 36, 3], [3, 48, 1, .7], [6, 36, 2], [8, 39, 2], [10, 41, 2], [14, 43, 2]],
      [[0, 39, 3], [3, 51, 1, .7], [6, 39, 2], [8, 43, 2], [10, 34, 2], [14, 34, 2]],
      [[0, 38, 3], [3, 50, 1, .7], [6, 38, 2], [8, 42, 2], [10, 33, 2], [14, 36, 2]],
    ],
    lead: [
      [[0, 86, 6], [6, 84, 2], [8, 82, 8]],
      [[0, 79, 10], [12, 81, 4]],
      [[0, 82, 6], [6, 81, 2], [8, 79, 6], [14, 81, 2]],
      [[0, 78, 8], [8, 81, 8]],
    ],
    keys: [
      [[0, [55, 58, 62, 65, 69], 14, .55]],
      [[0, [51, 55, 58, 60], 14, .55]],
      [[0, [51, 55, 58, 62], 14, .55]],
      [[0, [50, 54, 57, 60], 14, .55]],
    ],
    keysCut: 1900,
  },
  {
    id: 'lofi', name: 'Lo-Fi Study', style: 'Lo-fi', bpm: 82, swing: 0.62, steps: 16, color: '#4fdc8f', crackle: 1,
    mix: { kick: .8, snare: .55, rim: .7, hat: .32, bass: .8, keys: 1.1 },
    kick: ['x.......x.x.....', 'x......x..x.....'],
    snare: ['....x.......x...'],
    rim: ['....x.......x...'],
    hat: ['x.o.x.o.x.o.x.o.'],
    bass: [
      [[0, 39, 8], [10, 39, 4]],
      [[0, 36, 8], [10, 36, 4]],
      [[0, 32, 8], [10, 32, 4]],
      [[0, 34, 8], [10, 34, 4]],
    ],
    keys: [
      [[0, [51, 55, 58, 62, 65], 10, .75], [10, [51, 55, 58, 62, 65], 6, .5]],
      [[0, [48, 51, 55, 58, 62], 10, .75], [10, [48, 51, 55, 58, 62], 6, .5]],
      [[0, [51, 55, 56, 60], 10, .75], [10, [51, 55, 56, 60], 6, .5]],
      [[0, [50, 55, 56, 60], 10, .75], [10, [50, 55, 56, 60], 6, .5]],
    ],
    keysCut: 1500, kickSoft: true,
  },
  {
    id: 'rooftop', name: 'Rooftop Cypher', style: 'Hard boom bap', bpm: 98, swing: 0.54, steps: 16, color: '#3fb8f0',
    mix: { kick: 1.1, snare: 1.1, hat: .5, bass: .9, stab: 1 },
    kick: ['x.x.......x.....', 'x.x.......x..x..'],
    snare: ['....x.......x...'],
    hat: ['x.x.x.x.x.x.x.x.'],
    ohat: ['................', '..............o.'],
    bass: [
      [[0, 38, 2], [2, 38, 6], [10, 41, 4]],
      [[0, 34, 2], [2, 34, 6], [10, 36, 3], [13, 33, 2]],
    ],
    stab: [
      [[0, [62, 65, 69], 2, 1], [7, [62, 65, 69], 1, .6]],
      [[0, [58, 62, 65], 2, 1], [10, [60, 64, 67], 2, .8]],
    ],
  },
  {
    id: 'knockout', name: 'Knockout', style: 'Punchy boom bap', bpm: 94, swing: 0.53, steps: 16, color: '#ff5f8f',
    punch: true, duck: true, drive: 1.25, stabCut: 4600, snareOpts: { tone: 205, dec: 0.17, bp: 2200, rev: 0.18 },
    mix: { kick: 1.3, snare: 1, clap: 0.8, hat: 0.45, sub: 0.62, stab: 1.2 },
    kick: ["x..x....x.x.....", "x..x....x.x..x..", "x..x....x.x.....", "x.x.......x..x.."],
    snare: ["....X.......X...", "....X.......X...", "....X.......X...", "....X.......X..-"],
    clap: ["....x.......x..."],
    hat: ["x.o.x.o.x.o.x.o."],
    ohat: ["................", "..............o.", "................", "..............o."],
    sub: [
      [[0, 40, 2], [3, 40, 2], [8, 43, 2], [10, 40, 3]],
      [[0, 40, 2], [3, 40, 2], [8, 38, 2], [10, 38, 2], [13, 40, 2]],
      [[0, 40, 2], [3, 40, 2], [8, 45, 2], [10, 43, 3]],
      [[0, 36, 2], [2, 36, 6], [10, 38, 3], [13, 35, 3]],
    ],
    stab: [
      [[0, [64, 67, 71], 2, 1], [3, [64, 67, 71], 1, 0.7]],
      [[0, [62, 66, 69], 2, 0.9], [10, [62, 66, 69], 1, 0.6]],
      [[0, [64, 67, 71], 2, 1], [3, [64, 67, 71], 1, 0.7]],
      [[0, [60, 64, 67], 2, 0.9], [8, [59, 62, 66], 2, 0.9]],
    ],
  },
  {
    id: 'pressure', name: 'Pressure', style: 'Drill (142 feel)', bpm: 71, swing: 0.5, steps: 32, color: '#9aa7ff',
    punch: true, duck: true, drive: 1.3, hatMetal: true, snareOpts: { tone: 230, dec: 0.13, bp: 2600, rev: 0.25 },
    mix: { kick: 1, snare: 1, clap: 0.7, hat: 0.5, sub: 0.95, piano: 1, pad: 0.8 },
    kick: ["x.........x.....x.........x.....", "x.........x.......x.......x....."],
    snare: ["........x.....-.........x.......", "........x...............x..o...."],
    clap: ["........x...............x......."],
    hat: ["x..x..x.x..x..x.x..x..x.x..x.xxx", "x..x..x.x..x..x.x..x..x.xxx.x..x"],
    sub: [
      [[0, 42, 9], [10, 42, 5], [16, 45, 8, 1, 42], [26, 40, 6, 1, 45]],
      [[0, 42, 9], [10, 38, 6, 1, 42], [18, 37, 8], [26, 35, 6, 1, 37]],
    ],
    piano: [
      [[0, 73, 3, 0.9], [4, 69, 3, 0.6], [8, 66, 3, 0.7], [12, 69, 3, 0.6], [16, 74, 3, 0.9], [20, 73, 3, 0.6], [24, 69, 3, 0.7], [28, 66, 3, 0.6]],
      [[0, 73, 3, 0.9], [4, 69, 3, 0.6], [8, 66, 3, 0.7], [12, 69, 3, 0.6], [16, 76, 3, 0.9], [20, 74, 3, 0.6], [24, 73, 3, 0.7], [28, 62, 3, 0.6]],
    ],
    pad: [[[0, [54, 57, 61], 32, 0.7]], [[0, [50, 54, 57], 32, 0.7]]],
  },
  {
    id: 'dropzone', name: 'Drop Zone', style: 'Trap with drops', bpm: 74, swing: 0.5, steps: 32, color: '#36e2c8',
    // arrangement: builds up, cuts out for half a beat, then drops at the top of every turn (every 16 bars when practicing)
    drops: true, punch: true, duck: true, drive: 1.2, hatMetal: true, outGain: 0.7,
    snareOpts: { tone: 215, dec: 0.15, bp: 2400, rev: 0.26 },
    dropOnly: ['stab', 'bell'], introParts: ['hat', 'pad'],
    mix: { kick: 1, snare: 0.95, clap: 0.8, hat: 0.42, sub: 0.8, stab: 1.05, pad: 0.85, bell: 0.6, riser: 0.85, impact: 0.6, crash: 0.8 },
    kick: ["x.............x.....x...........", "x.........x.........x.....x.....", "x.............x.....x...........", "x.........x...........x...x.x..."],
    snare: ["................x...............", "................x...............", "................x...............", "................x.............-."],
    clap: ["................x..............."],
    hat: ["x.o.x.o.x.o.x.o.x.o.x.o.x.o.x.o.", "x.o.x.o.x.o.x.o.x.o.x.o.xoxoxoo.", "x.o.x.o.x.o.x.o.x.o.x.o.x.o.x.o.", "x.o.x.o.xoxox.o.x.o.x.o.x.o.oooo"],
    sub: [
      [[0, 36, 12], [14, 36, 5], [20, 36, 10]],
      [[0, 32, 10], [10, 32, 9], [20, 32, 6], [26, 34, 6, 1, 32]],
      [[0, 39, 12], [14, 39, 5], [20, 39, 10]],
      [[0, 34, 10], [10, 34, 10], [22, 34, 4], [26, 38, 2, 1, 34], [28, 41, 4, 1, 38]],
    ],
    stab: [[[0, [60, 63, 67, 72], 5, 1], [6, [60, 63, 67, 72], 3, 0.7], [12, [60, 63, 67, 72], 4, 0.85], [20, [60, 63, 67, 72], 3, 0.7], [26, [60, 63, 67, 72], 4, 0.8]], [[0, [56, 60, 63, 68], 5, 1], [6, [56, 60, 63, 68], 3, 0.7], [12, [56, 60, 63, 68], 4, 0.85], [20, [56, 60, 63, 68], 3, 0.7], [26, [56, 60, 63, 68], 4, 0.8]], [[0, [58, 63, 67, 70], 5, 1], [6, [58, 63, 67, 70], 3, 0.7], [12, [58, 63, 67, 70], 4, 0.85], [20, [58, 63, 67, 70], 3, 0.7], [26, [58, 63, 67, 70], 4, 0.8]], [[0, [58, 62, 65, 70], 5, 1], [6, [58, 62, 65, 70], 3, 0.7], [12, [58, 62, 65, 70], 4, 0.85], [20, [58, 62, 65, 70], 3, 0.7], [26, [58, 62, 65, 70], 4, 0.8]]],
    stabCut: 5200,
    bell: [
      [[0, 79, 4, 0.9], [4, 75, 4, 0.6], [8, 72, 4, 0.7], [16, 79, 4, 0.8], [20, 80, 4, 0.6], [24, 79, 8, 0.7]],
      [[0, 75, 4, 0.9], [4, 72, 4, 0.6], [8, 68, 4, 0.7], [16, 75, 4, 0.8], [20, 77, 4, 0.6], [24, 75, 8, 0.7]],
      [[0, 79, 4, 0.9], [4, 75, 4, 0.6], [8, 70, 4, 0.7], [16, 79, 4, 0.8], [20, 82, 4, 0.6], [24, 79, 8, 0.7]],
      [[0, 77, 4, 0.9], [4, 74, 4, 0.6], [8, 70, 4, 0.7], [16, 74, 4, 0.8], [20, 77, 4, 0.6], [24, 74, 8, 0.7]],
    ],
    pad: [[[0, [48, 51, 55], 32, 0.8]], [[0, [44, 48, 51], 32, 0.8]], [[0, [46, 51, 55], 32, 0.8]], [[0, [46, 50, 53], 32, 0.8]]],
    buildPad: [46, 50, 53, 58],
  },
  // ---------- genre flips: other styles with hip-hop drums on top ----------
  {
    id: 'bluenote', name: 'Blue Note Lounge', style: 'Jazz hop', genre: true, bpm: 86, swing: 0.62, steps: 16, color: '#7fb3ff', crackle: 0.45,
    mix: { kick: 0.95, snare: 0.8, rim: 0.5, hat: 0.4, bass: 1, keys: 1.05, mallet: 0.55 },
    kick: ['x.......x.x.....', 'x......x..x.....', 'x.......x.x.....', 'x......x..x..x..'],
    snare: ['....x.......x...', '....x.......x..-', '....x.......x...', '....x..-....x...'],
    rim: ['.......o........', '...............o'],
    hat: ['x.o.x.o.x.o.x.o.'],
    // walking upright bass: ii-V-I-vi in F
    bass: [
      [[0, 43, 3], [4, 46, 3], [8, 50, 3], [12, 49, 3]],
      [[0, 48, 3], [4, 46, 3], [8, 45, 3], [12, 40, 3]],
      [[0, 41, 3], [4, 45, 3], [8, 48, 3], [12, 45, 3]],
      [[0, 38, 3], [4, 41, 3], [8, 45, 3], [12, 42, 3]],
    ],
    keys: [
      [[0, [58, 62, 65, 69], 3, 0.9], [6, [58, 62, 65, 69], 2, 0.55], [10, [58, 62, 65, 69], 5, 0.75]],
      [[0, [58, 62, 64, 69], 3, 0.9], [6, [58, 62, 64, 69], 2, 0.55], [10, [58, 62, 64, 69], 5, 0.75]],
      [[0, [57, 60, 64, 67], 3, 0.9], [6, [57, 60, 64, 67], 2, 0.55], [10, [57, 60, 64, 67], 5, 0.75]],
      [[0, [53, 57, 60, 64], 3, 0.9], [6, [53, 57, 60, 64], 2, 0.55], [10, [53, 57, 60, 64], 5, 0.75]],
    ],
    keysCut: 2600,
    mallet: [[[13, 74, 2, 0.6], [14, 72, 2, 0.45]], [], [[12, 76, 2, 0.6], [14, 74, 2, 0.5]], [[13, 72, 2, 0.6], [14, 69, 2, 0.5]]],
  },
  {
    id: 'sunday', name: 'Sunday Service', style: 'Gospel soul', genre: true, bpm: 78, swing: 0.56, steps: 16, color: '#c9a2ff',
    mix: { kick: 1, snare: 0.75, clap: 0.9, hat: 0.38, bass: 1, organ: 1, piano: 0.8, perc: 0.7 },
    kick: ['x.....x...x.....', 'x.....x...x..x..'],
    snare: ['....x.......x...'],
    clap: ['....x.......x...', '....x.......x.o.'],
    hat: ['x.o.x.o.x.o.x.o.'],
    perc: { tamb: ['..x...x...x...x.'] },
    // Ab - Cm7 - Fm9 - Db/Eb
    organ: [[[0, [56, 60, 63, 67], 15, 0.9]], [[0, [55, 58, 60, 63], 15, 0.9]], [[0, [55, 56, 60, 63], 15, 0.9]], [[0, [56, 61, 65, 68], 9, 0.9], [10, [58, 61, 65, 70], 5, 0.9]]],
    piano: [
      [[4, 72, 2, 0.7], [4, 84, 2, 0.5], [12, 72, 2, 0.7], [12, 84, 2, 0.5]],
      [[4, 70, 2, 0.7], [4, 82, 2, 0.5], [12, 72, 2, 0.7], [12, 84, 2, 0.5]],
      [[4, 72, 2, 0.7], [4, 84, 2, 0.5], [12, 75, 2, 0.7], [12, 87, 2, 0.5]],
      [[4, 73, 2, 0.7], [4, 85, 2, 0.5], [10, 75, 1, 0.6], [11, 77, 1, 0.6], [12, 79, 2, 0.75]],
    ],
    bass: [
      [[0, 44, 6], [7, 44, 2], [10, 51, 3], [14, 48, 2]],
      [[0, 36, 6], [7, 36, 2], [10, 43, 3], [14, 46, 2]],
      [[0, 41, 6], [7, 41, 2], [10, 48, 3], [14, 44, 2]],
      [[0, 39, 6], [7, 39, 2], [10, 46, 3], [13, 41, 1], [14, 43, 2]],
    ],
  },
  {
    id: 'island', name: 'Island Time', style: 'Reggae dub', genre: true, bpm: 76, swing: 0.55, steps: 16, color: '#5fd38d',
    echo: { steps: 3, send: 0.32 }, pluckKind: 'mute',
    mix: { kick: 1, snare: 0.85, rim: 0.65, hat: 0.38, bass: 1.15, pluck: 1, organ: 0.55 },
    kick: ['x.......x.x.....', 'x......x..x.....'],
    snare: ['....x.......x...'],
    rim: ['..........o.....', '......o.......o.'],
    hat: ['x.o.x.o.x.o.x.o.'],
    // skank on 2 and 4, organ bubble on the off-beats: Am - Dm - G - Em
    pluck: [[[4, [69, 72, 76], 1, 1], [12, [69, 72, 76], 1, 1]], [[4, [69, 74, 77], 1, 1], [12, [69, 74, 77], 1, 1]], [[4, [67, 71, 74], 1, 1], [12, [67, 71, 74], 1, 1]], [[4, [67, 71, 76], 1, 1], [12, [67, 71, 76], 1, 1]]],
    organ: [
      [[2, [57, 60, 64], 1, 0.7], [6, [57, 60, 64], 1, 0.6], [10, [57, 60, 64], 1, 0.7], [14, [57, 60, 64], 1, 0.6]],
      [[2, [57, 62, 65], 1, 0.7], [6, [57, 62, 65], 1, 0.6], [10, [57, 62, 65], 1, 0.7], [14, [57, 62, 65], 1, 0.6]],
      [[2, [55, 59, 62], 1, 0.7], [6, [55, 59, 62], 1, 0.6], [10, [55, 59, 62], 1, 0.7], [14, [55, 59, 62], 1, 0.6]],
      [[2, [55, 59, 64], 1, 0.7], [6, [55, 59, 64], 1, 0.6], [10, [55, 59, 64], 1, 0.7], [14, [55, 59, 64], 1, 0.6]],
    ],
    bass: [
      [[0, 45, 3], [4, 45, 1], [6, 52, 2], [10, 48, 2], [12, 50, 3]],
      [[0, 38, 3], [4, 38, 1], [6, 45, 2], [10, 41, 2], [12, 43, 3]],
      [[0, 43, 3], [4, 43, 1], [6, 50, 2], [10, 47, 2], [12, 45, 3]],
      [[0, 40, 3], [4, 40, 1], [6, 47, 2], [10, 43, 2], [12, 44, 3]],
    ],
  },
  {
    id: 'calle', name: 'Calle Ocho', style: 'Latin', genre: true, bpm: 94, swing: 0.5, steps: 16, color: '#ff9f43',
    mix: { kick: 1.15, snare: 0.75, rim: 0.75, hat: 0.36, bass: 1.2, piano: 1.15, perc: 0.9 },
    kick: ['x...x...x...x...'],
    snare: ['...x..x....x..x.'],
    rim: ['...x..x....x..x.'],
    hat: ['x.o.x.o.x.o.x.o.'],
    perc: { congaHi: ['..x...x...x.x...', '..x...x.x.x...x.'], congaLo: ['.......x......x.', '.......x.......x'], cowbell: ['x...x...x...x...'], shaker: ['.xx..xx..xx..xx.'] },
    percMix: { cowbell: 0.7, shaker: 0.8 },
    // piano montuno over Am - Dm - G - C
    piano: [
      [[0, 57, 2, 0.8], [0, 69, 2, 0.9], [3, 72, 1, 0.7], [4, 76, 2, 0.75], [6, 72, 1, 0.7], [8, 69, 2, 0.8], [10, 76, 1, 0.7], [11, 72, 1, 0.65], [14, 74, 2, 0.75]],
      [[0, 57, 2, 0.8], [0, 69, 2, 0.9], [3, 74, 1, 0.7], [4, 77, 2, 0.75], [6, 74, 1, 0.7], [8, 69, 2, 0.8], [10, 77, 1, 0.7], [11, 74, 1, 0.65], [14, 72, 2, 0.75]],
      [[0, 55, 2, 0.8], [0, 67, 2, 0.9], [3, 71, 1, 0.7], [4, 74, 2, 0.75], [6, 71, 1, 0.7], [8, 67, 2, 0.8], [10, 74, 1, 0.7], [11, 71, 1, 0.65], [14, 72, 2, 0.75]],
      [[0, 55, 2, 0.8], [0, 67, 2, 0.9], [3, 72, 1, 0.7], [4, 76, 2, 0.75], [6, 72, 1, 0.7], [8, 67, 2, 0.8], [10, 76, 1, 0.7], [11, 72, 1, 0.65], [14, 71, 2, 0.75]],
    ],
    bass: [
      [[0, 45, 2], [6, 45, 3], [12, 52, 4]],
      [[0, 50, 2], [6, 38, 3], [12, 45, 4]],
      [[0, 43, 2], [6, 43, 3], [12, 50, 4]],
      [[0, 48, 2], [6, 36, 3], [12, 43, 4]],
    ],
  },
  {
    id: 'lagos', name: 'Lagos Sunset', style: 'Afrobeats', genre: true, bpm: 102, swing: 0.54, steps: 16, color: '#ffd166',
    mix: { kick: 1.15, clap: 0.9, rim: 0.7, hat: 0.32, log: 1.35, mallet: 1.15, pad: 0.7, perc: 0.9 },
    kick: ['x......x..x.....', 'x......x..x...x.'],
    clap: ['....x.......x...'],
    rim: ['...x..x....x..x.'],
    hat: ['x.x.x.x.x.x.x.x.'],
    perc: { shaker: ['oxxoxxoxoxxoxxox'], congaHi: ['x..x...x.x..x...'], congaLo: ['......x.......x.'] },
    percMix: { shaker: 0.7 },
    // log-drum bass and a marimba riff over Bbmaj7 - Gm7 - Ebmaj7 - F
    log: [
      [[0, 46, 3], [3, 46, 2, 0.7], [6, 53, 2, 0.8], [10, 46, 3], [14, 50, 2, 0.8]],
      [[0, 43, 3], [3, 43, 2, 0.7], [6, 50, 2, 0.8], [10, 43, 3], [14, 46, 2, 0.8]],
      [[0, 39, 3], [3, 39, 2, 0.7], [6, 46, 2, 0.8], [10, 39, 3], [14, 43, 2, 0.8]],
      [[0, 41, 3], [3, 41, 2, 0.7], [6, 48, 2, 0.8], [10, 41, 3], [14, 45, 2, 0.8]],
    ],
    mallet: [
      [[0, 74, 2], [3, 77, 2, 0.8], [6, 74, 2, 0.8], [8, 70, 2], [10, 72, 2, 0.8], [13, 74, 2, 0.8]],
      [[0, 74, 2], [3, 77, 2, 0.8], [6, 74, 2, 0.8], [8, 70, 2], [10, 67, 2, 0.8], [13, 70, 2, 0.8]],
      [[0, 75, 2], [3, 79, 2, 0.8], [6, 75, 2, 0.8], [8, 70, 2], [10, 72, 2, 0.8], [13, 74, 2, 0.8]],
      [[0, 72, 2], [3, 77, 2, 0.8], [6, 72, 2, 0.8], [8, 69, 2], [10, 72, 2, 0.8], [13, 74, 2, 0.8]],
    ],
    pad: [[[0, [58, 62, 65, 69], 16, 0.7]], [[0, [55, 58, 62, 65], 16, 0.7]], [[0, [55, 58, 62, 63], 16, 0.7]], [[0, [57, 60, 65], 16, 0.7]]],
  },
  {
    id: 'powerchord', name: 'Power Chord', style: 'Rock', genre: true, bpm: 92, swing: 0.5, steps: 16, color: '#ff4d4d',
    mix: { kick: 1.25, snare: 1.15, hat: 0.42, bass: 0.95, power: 1.2, crash: 0.55 },
    snareOpts: { tone: 200, dec: 0.22, bp: 2000, rev: 0.38 },
    kick: ['x.......x.x.....', 'x.x.....x.......', 'x.......x.x.....', 'x.x.....x.x..x..'],
    snare: ['....X.......X...', '....X.......X...', '....X.......X...', '....X.......X.--'],
    hat: ['x.x.x.x.x.x.x.x.'],
    crashPat: ['x...............', '................', '................', '................'],
    // E5 - G5 - A5 - D5 with palm-muted chugs
    power: [
      [[0, [40, 47, 52], 3, 1], [4, [40, 47], 1, 0.6], [6, [40, 47], 1, 0.6], [8, [40, 47, 52], 3, 0.9], [12, [40, 47], 1, 0.6], [14, [40, 47], 1, 0.7]],
      [[0, [43, 50, 55], 3, 1], [4, [43, 50], 1, 0.6], [6, [43, 50], 1, 0.6], [8, [43, 50, 55], 3, 0.9], [12, [43, 50], 1, 0.6], [14, [43, 50], 1, 0.7]],
      [[0, [45, 52, 57], 3, 1], [4, [45, 52], 1, 0.6], [6, [45, 52], 1, 0.6], [8, [45, 52, 57], 3, 0.9], [12, [45, 52], 1, 0.6], [14, [45, 52], 1, 0.7]],
      [[0, [38, 45, 50], 6, 1], [8, [38, 45, 50], 3, 0.9], [12, [43, 50, 55], 1, 0.8], [14, [45, 52, 57], 2, 0.9]],
    ],
    bass: [
      [[0, 40, 3], [4, 40, 1], [6, 40, 1], [8, 40, 3], [12, 40, 1], [14, 40, 1]],
      [[0, 43, 3], [4, 43, 1], [6, 43, 1], [8, 43, 3], [12, 43, 1], [14, 43, 1]],
      [[0, 45, 3], [4, 45, 1], [6, 45, 1], [8, 45, 3], [12, 45, 1], [14, 45, 1]],
      [[0, 38, 6], [8, 38, 3], [12, 43, 1], [14, 45, 2]],
    ],
  },
  {
    id: 'levelup', name: 'Level Up', style: 'Chiptune', genre: true, bpm: 90, swing: 0.5, steps: 16, color: '#4de1ff',
    chipWave: 'p25',
    mix: { kick: 1.2, snare: 1, hat: 0.42, chip: 1.35, chipLead: 1.15, chipBass: 1.5 },
    kick: ['x......x..x.....', 'x......x..x..x..'],
    snare: ['....x.......x...'],
    hat: ['x.x.x.x.x.x.x.x.'],
    // 16th arpeggios over Cm - Ab - Bb - G, with a square-wave tune on top
    chip: [[60, 63, 67, 72], [56, 60, 63, 68], [58, 62, 65, 70], [55, 59, 62, 67]].map(ch => Array.from({ length: 16 }, (_, i) => [i, ch[i % 4], 1, i % 4 ? 0.7 : 1])),
    chipLead: [
      [[0, 75, 4], [4, 74, 2], [6, 72, 4], [10, 70, 2], [12, 72, 4]],
      [[0, 68, 6], [6, 67, 2], [8, 68, 4], [12, 70, 4]],
      [[0, 70, 4], [4, 72, 2], [6, 74, 4], [10, 77, 2], [12, 74, 4]],
      [[0, 71, 6], [6, 72, 2], [8, 74, 4], [12, 67, 4]],
    ],
    chipBass: [
      [[0, 48, 1], [2, 60, 1], [4, 48, 1], [6, 60, 1], [8, 48, 1], [10, 60, 1], [12, 48, 1], [14, 55, 1]],
      [[0, 44, 1], [2, 56, 1], [4, 44, 1], [6, 56, 1], [8, 44, 1], [10, 56, 1], [12, 44, 1], [14, 51, 1]],
      [[0, 46, 1], [2, 58, 1], [4, 46, 1], [6, 58, 1], [8, 46, 1], [10, 58, 1], [12, 46, 1], [14, 53, 1]],
      [[0, 43, 1], [2, 55, 1], [4, 43, 1], [6, 55, 1], [8, 43, 1], [10, 55, 1], [12, 47, 1], [14, 50, 1]],
    ],
  },
  {
    id: 'kingdom', name: 'Kingdom', style: 'Orchestral trap', genre: true, bpm: 70, swing: 0.5, steps: 32, color: '#e6c27a',
    punch: true, duck: true, drive: 1.15, hatMetal: true, pluckKind: 'pizz',
    mix: { kick: 0.95, snare: 0.9, clap: 0.75, hat: 0.45, sub: 0.85, strings: 1, stab: 0.8, pluck: 0.8, crash: 0.5 },
    kick: ['x.........x.............x.......', 'x.........x.......x.......x.....'],
    clap: ['................x...............'],
    snare: ['................x...............', '................x.............-.'],
    hat: ['x.x.x.x.x.x.x.x.x.x.x.x.xxxxx.x.', 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.oooo'],
    crashPat: ['x...............................', '................................', '................................', '................................'],
    // Dm - Bb - Gm - A: strings, brass hits, pizzicato ostinato, 808
    strings: [[[0, [50, 57, 62, 65, 69], 32, 0.9]], [[0, [46, 53, 58, 62, 65], 32, 0.9]], [[0, [43, 50, 55, 58, 62], 32, 0.9]], [[0, [45, 52, 57, 61, 64], 32, 0.9]]],
    stab: [[[0, [62, 65, 69, 74], 4, 1], [20, [62, 65, 69, 74], 3, 0.7]], [[0, [58, 62, 65, 70], 4, 1]], [[0, [55, 58, 62, 67], 4, 1], [20, [55, 58, 62, 67], 3, 0.7]], [[0, [57, 61, 64, 69], 4, 1], [24, [57, 61, 64, 69], 3, 0.8]]],
    stabCut: 2800,
    pluck: [
      [[0, 62, 3], [4, 69, 3, 0.7], [8, 65, 3, 0.8], [12, 69, 3, 0.7], [16, 62, 3], [20, 69, 3, 0.7], [24, 65, 3, 0.8], [28, 69, 3, 0.7]],
      [[0, 62, 3], [4, 70, 3, 0.7], [8, 65, 3, 0.8], [12, 70, 3, 0.7], [16, 62, 3], [20, 70, 3, 0.7], [24, 65, 3, 0.8], [28, 70, 3, 0.7]],
      [[0, 62, 3], [4, 67, 3, 0.7], [8, 70, 3, 0.8], [12, 67, 3, 0.7], [16, 62, 3], [20, 67, 3, 0.7], [24, 70, 3, 0.8], [28, 67, 3, 0.7]],
      [[0, 61, 3], [4, 69, 3, 0.7], [8, 64, 3, 0.8], [12, 69, 3, 0.7], [16, 61, 3], [20, 67, 3, 0.7], [24, 64, 3, 0.8], [28, 69, 3, 0.7]],
    ],
    sub: [
      [[0, 38, 14], [16, 38, 6], [24, 41, 8, 1, 38]],
      [[0, 34, 14], [16, 34, 6], [24, 38, 8, 1, 34]],
      [[0, 31, 14], [16, 31, 6], [24, 34, 8, 1, 31]],
      [[0, 33, 14], [16, 33, 6], [24, 37, 8, 1, 33]],
    ],
  },
  {
    id: 'dirtroad', name: 'Dirt Road', style: 'Country twang', genre: true, bpm: 88, swing: 0.55, steps: 16, color: '#d9a066',
    pluckKind: 'banjo',
    mix: { kick: 1.15, snare: 0.95, hat: 0.4, bass: 1.25, pluck: 1.1, perc: 0.65 },
    kick: ['x.....x...x.....', 'x.....x...x..x..'],
    snare: ['....x.......x...'],
    hat: ['x.x.x.x.x.x.x.x.'],
    perc: { tamb: ['....x.......x...'] },
    // banjo forward rolls over G - C - D - G with a boom-chicka bass
    pluck: [[62, 67, 71], [64, 67, 72], [62, 66, 69], [62, 67, 71]].map(ch => [0, 1, 2, 0, 1, 2, 0, 2, 0, 1, 2, 0, 1, 2, 0, 2].map((k, i) => [i, ch[k], 2, i % 4 ? 0.7 : 1])),
    bass: [
      [[0, 43, 3], [8, 38, 3]],
      [[0, 36, 3], [8, 43, 3]],
      [[0, 38, 3], [8, 45, 3]],
      [[0, 43, 3], [8, 38, 3], [12, 40, 2], [14, 42, 2]],
    ],
  },
  {
    id: 'silkroad', name: 'Silk Road', style: 'Desert trap', genre: true, bpm: 74, swing: 0.5, steps: 32, color: '#f4a259',
    punch: true, duck: true, drive: 1.15, hatMetal: true, pluckKind: 'sitar',
    mix: { kick: 0.95, clap: 0.8, snare: 0.8, hat: 0.42, sub: 0.85, pluck: 0.95, pad: 0.55, perc: 0.75 },
    kick: ['x.............x.....x...........', 'x.........x.........x.....x.....'],
    clap: ['................x...............'],
    snare: ['................x...............'],
    hat: ['x.x.x.x.x.x.x.x.x.x.x.x.x.x.xxxx', 'x.x.x.x.x.x.x.x.xxx.x.x.x.x.x.x.'],
    perc: { tablaNa: ['....x.x.....x.......x.x...x.x...'], tablaGe: ['x.......x.........x.....x.......'] },
    // a sitar line in D Phrygian dominant over a drone
    pluck: [
      [[0, 62, 6], [6, 63, 2, 0.7], [8, 66, 4, 0.85], [12, 67, 4, 0.8], [16, 69, 6], [22, 67, 2, 0.7], [24, 66, 4, 0.85], [28, 63, 4, 0.8]],
      [[0, 62, 6], [6, 63, 2, 0.7], [8, 66, 4, 0.85], [12, 63, 2, 0.7], [14, 62, 2, 0.7], [16, 60, 6], [22, 58, 2, 0.7], [24, 60, 4, 0.85], [28, 62, 4, 0.8]],
    ],
    pad: [[[0, [50, 57, 62], 32, 0.7]]],
    sub: [
      [[0, 38, 12], [14, 38, 5], [20, 38, 10]],
      [[0, 38, 10], [10, 38, 10], [20, 39, 4, 1, 38], [26, 36, 6, 1, 39]],
    ],
  },
  {
    id: 'discoball', name: 'Disco Ball', style: 'Funk', genre: true, bpm: 100, swing: 0.52, steps: 16, color: '#ff6fd8',
    pluckKind: 'mute',
    mix: { kick: 1.15, snare: 0.95, hat: 0.4, fbass: 1.25, pluck: 0.95, stab: 0.8, perc: 0.6 },
    kick: ['x..x....x.x.....', 'x..x....x.x..x..'],
    snare: ['....x.......x...', '....x.......x..-'],
    hat: ['x.o.x.o.x.o.x.o.'],
    ohat: ['..............o.', '................'],
    perc: { tamb: ['..x...x...x...x.'] },
    // slap bass and scratchy rhythm guitar over Em9 - A13
    fbass: [
      [[0, 40, 2], [3, 52, 1, 0.8], [4, 40, 1], [6, 52, 1, 0.8], [8, 43, 2], [10, 45, 1], [11, 47, 1, 0.8], [12, 40, 2], [14, 52, 1, 0.8]],
      [[0, 45, 2], [3, 57, 1, 0.8], [4, 45, 1], [6, 57, 1, 0.8], [8, 48, 2], [10, 47, 1], [11, 45, 1, 0.8], [12, 43, 2], [14, 42, 1, 0.8]],
    ],
    pluck: [
      [[0, [62, 66, 67, 71], 1, 1], [2, [62, 66, 67, 71], 1, 0.45], [3, [62, 66, 67, 71], 1, 0.6], [6, [62, 66, 67, 71], 1, 0.9], [8, [62, 66, 67, 71], 1, 0.45], [10, [62, 66, 67, 71], 1, 0.9], [11, [62, 66, 67, 71], 1, 0.5], [14, [62, 66, 67, 71], 1, 0.8]],
      [[0, [61, 64, 67, 71], 1, 1], [2, [61, 64, 67, 71], 1, 0.45], [3, [61, 64, 67, 71], 1, 0.6], [6, [61, 64, 67, 71], 1, 0.9], [8, [61, 64, 67, 71], 1, 0.45], [10, [61, 64, 67, 71], 1, 0.9], [11, [61, 64, 67, 71], 1, 0.5], [14, [61, 64, 67, 71], 1, 0.8]],
    ],
    stab: [[[14, [74, 78, 83], 2, 0.8]], [[14, [73, 76, 81], 2, 0.8]]],
    stabCut: 4200,
  },
  {
    id: 'phonk', name: 'Midnight Drift', style: 'Phonk (144 feel)', genre: true, bpm: 72, swing: 0.5, steps: 32, color: '#b8ff3c',
    // distorted 808 under a pitched cowbell riff in C# minor; drums and bass are pushed hard into saturation
    punch: true, duck: true, drive: 2.1, hatMetal: true, outGain: 0.64, snareOpts: { tone: 240, dec: 0.12, bp: 2800, rev: 0.2 },
    mix: { kick: 1.05, snare: 0.85, clap: 0.95, hat: 0.5, sub: 1, cowbell: 1.1 },
    kick: ['x.........x.....x.........x.....', 'x.........x.......x.......x.....', 'x.........x.....x.........x.....', 'x.........x.......x.....x.x.x...'],
    clap: ['................x...............'],
    snare: ['................x...............', '................x.............-.', '................x...............', '................x.........x.x.xX'],
    hat: ['x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.x.x.x.x.xxxxx.x.', 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.', 'x.x.x.x.xxx.x.x.x.x.x.x.x.x.oooo'],
    ohat: ['............o...............o...', '............o...................'],
    cowbell: [
      [[0, 73, 3], [4, 73, 2, 0.7], [6, 80, 2, 0.85], [10, 78, 2, 0.8], [12, 76, 3, 0.9], [16, 73, 3], [20, 73, 2, 0.7], [22, 76, 2, 0.85], [26, 78, 2, 0.8], [28, 75, 3, 0.9]],
      [[0, 73, 3], [4, 73, 2, 0.7], [6, 80, 2, 0.85], [10, 78, 2, 0.8], [12, 76, 3, 0.9], [16, 81, 3], [20, 80, 2, 0.8], [22, 78, 2, 0.8], [26, 76, 2, 0.8], [28, 71, 3, 0.9]],
      [[0, 73, 3], [4, 73, 2, 0.7], [6, 80, 2, 0.85], [10, 78, 2, 0.8], [12, 76, 3, 0.9], [16, 73, 3], [20, 73, 2, 0.7], [22, 76, 2, 0.85], [26, 78, 2, 0.8], [28, 75, 3, 0.9]],
      [[0, 73, 3], [4, 73, 2, 0.7], [6, 80, 2, 0.85], [10, 78, 2, 0.8], [12, 76, 3, 0.9], [16, 85, 3], [20, 83, 2, 0.8], [22, 80, 2, 0.8], [24, 78, 2, 0.8], [26, 76, 2, 0.8], [28, 75, 2, 0.8], [30, 73, 2, 0.9]],
    ],
    sub: [
      [[0, 37, 10], [12, 37, 4], [16, 37, 6], [24, 40, 6, 1, 37]],
      [[0, 37, 10], [12, 37, 4], [16, 45, 6, 1, 37], [24, 44, 6, 1, 45]],
      [[0, 37, 10], [12, 37, 4], [16, 37, 6], [24, 40, 6, 1, 37]],
      [[0, 37, 8], [10, 37, 4], [16, 42, 6, 1, 37], [24, 44, 4], [28, 49, 4, 1, 44]],
    ],
  },
];
const VEL = { x: 1, X: 1.2, o: .65, '-': .35 };
