import austinNightWide from "@/assets/images/background/austin_night_wide.jpg";
import betweenBuildings from "@/assets/images/background/between_buildings.jpg";
import blanton from "@/assets/images/background/blanton.jpg";
import blantonNight from "@/assets/images/background/blanton_night.jpg";
import blantonNightArt from "@/assets/images/background/blanton_night_art.jpg";
import brazonGarage from "@/assets/images/background/brazon_garage.jpg";
import bridge from "@/assets/images/background/bridge.jpg";
import buildingWithOrange from "@/assets/images/background/building_with_orange.jpg";
import buildingWithOrangeBig from "@/assets/images/background/building_with_orange_big.jpg";
import clockKnotGreenery from "@/assets/images/background/clock_knot_greenery.jpg";
import dkrStadiumDay from "@/assets/images/background/dkr_stadium_day.jpg";
import dkrStadiumNight from "@/assets/images/background/dkr_stadium_night.jpg";
import eerDay from "@/assets/images/background/eer_day.jpg";
import eerLeftSide from "@/assets/images/background/eer_left_side.jpg";
import eerNight from "@/assets/images/background/eer_night.jpg";
import eerRightSide from "@/assets/images/background/eer_right_side.jpg";
import gdcArtStatue from "@/assets/images/background/gdc_art_statue.jpg";
import gdcBackDusk from "@/assets/images/background/gdc_back_dusk.jpg";
import gdcBalconyDusk from "@/assets/images/background/gdc_balcony_dusk.jpg";
import gdcFrontDusk from "@/assets/images/background/gdc_front_dusk.jpg";
import rlmCourtyard from "@/assets/images/background/rlm_courtyard.jpg";
import rlmHallway from "@/assets/images/background/rlm_hallway.jpg";
import rlpBridgeCenter from "@/assets/images/background/rlp_bridge_center.jpg";
import rlpBridgeGreenery from "@/assets/images/background/rlp_bridge_greenery.jpg";
import rlpBridgeOffset from "@/assets/images/background/rlp_bridge_offset.jpg";
import rlpNight from "@/assets/images/background/rlp_night.jpg";
import towerDay from "@/assets/images/background/tower_day.jpg";
import towerNight from "@/assets/images/background/tower_night.jpg";
import towerTopDay from "@/assets/images/background/tower_top_day.jpg";
import wcpGreeneryDay from "@/assets/images/background/wcp_greenery_day.jpg";
import welStairs from "@/assets/images/background/wel_stairs.jpg";

const gridImages = [
	{
		id: 14,
		gridArea: "4 / 1 / 6 / 3",
		src: eerNight,
		priority: false,
		sizes: "22vw",
	},
	{
		id: 17,
		gridArea: "5 / 5 / 6 / 8",
		src: austinNightWide,
		priority: false,
		sizes: "33vw",
	},
	{
		id: 15,
		gridArea: "5 / 3 / 6 / 4",
		src: dkrStadiumNight,
		priority: false,
		sizes: "11vw",
	},
	{
		id: 16,
		gridArea: "5 / 4 / 6 / 5",
		src: eerRightSide,
		priority: false,
		sizes: "11vw",
	},
	{
		id: 13,
		gridArea: "3 / 9 / 6 / 10",
		src: rlmHallway,
		priority: false,
		sizes: "11vw",
	},
	{
		id: 18,
		gridArea: "5 / 8 / 6 / 9",
		src: wcpGreeneryDay,
		priority: false,
		sizes: "11vw",
	},
	{
		id: 12,
		gridArea: "3 / 3 / 5 / 3",
		src: bridge,
		priority: false,
		sizes: "11vw",
	},
	{
		id: 19,
		gridArea: "4 / 7 / 5 / 9",
		src: clockKnotGreenery,
		priority: false,
		sizes: "22vw",
	},
	{
		id: 8,
		gridArea: "2 / 4 / 5 / 7",
		src: towerDay,
		priority: true,
		sizes: "33vw",
	}, // Center - priority
	{
		id: 10,
		gridArea: "3 / 8 / 4 / 9",
		src: welStairs,
		priority: false,
		sizes: "11vw",
	},
	{
		id: 9,
		gridArea: "2 / 7 / 4 / 8",
		src: blanton,
		priority: true,
		sizes: "11vw",
	}, // Visible - priority
	{
		id: 1,
		gridArea: "1 / 1 / 4 / 2",
		src: rlpBridgeCenter,
		priority: true,
		sizes: "11vw",
	}, // Visible - priority
	{
		id: 11,
		gridArea: "3 / 2 / 4 / 3",
		src: blantonNightArt,
		priority: false,
		sizes: "11vw",
	},
	{
		id: 7,
		gridArea: "2 / 2 / 3 / 4",
		src: buildingWithOrangeBig,
		priority: true,
		sizes: "22vw",
	}, // Visible - priority
	{
		id: 6,
		gridArea: "1 / 8 / 3 / 10",
		src: rlpNight,
		priority: true,
		sizes: "22vw",
	}, // Visible - priority
	{
		id: 2,
		gridArea: "1 / 2 / 2 / 3",
		src: towerTopDay,
		priority: false,
		sizes: "11vw",
	},
	{
		id: 3,
		gridArea: "1 / 3 / 2 / 6",
		src: rlpBridgeGreenery,
		priority: false,
		sizes: "33vw",
	},
	{
		id: 4,
		gridArea: "1 / 6 / 2 / 7",
		src: rlpBridgeOffset,
		priority: false,
		sizes: "11vw",
	},
	{
		id: 5,
		gridArea: "1 / 7 / 2 / 8",
		src: dkrStadiumDay,
		priority: false,
		sizes: "11vw",
	},
];

export {
	gridImages,
	austinNightWide,
	betweenBuildings,
	blanton,
	blantonNight,
	blantonNightArt,
	brazonGarage,
	bridge,
	buildingWithOrange,
	buildingWithOrangeBig,
	clockKnotGreenery,
	dkrStadiumDay,
	dkrStadiumNight,
	eerDay,
	eerLeftSide,
	eerNight,
	eerRightSide,
	gdcArtStatue,
	gdcBackDusk,
	gdcBalconyDusk,
	gdcFrontDusk,
	rlmCourtyard,
	rlmHallway,
	rlpBridgeCenter,
	rlpBridgeGreenery,
	rlpBridgeOffset,
	rlpNight,
	towerDay,
	towerNight,
	towerTopDay,
	wcpGreeneryDay,
	welStairs,
};
