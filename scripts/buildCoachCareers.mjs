import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "../src/data/world/coachCareers.json");

const career = (summaryTh, timeline) => ({ summaryTh, timeline });
const job = (from, to, team, teamTh, role = "manager", honours = [], noteTh) => ({
  from, to, team, teamTh, role, honours, ...(noteTh ? { noteTh } : {}),
});

// Major senior appointments only. Dates are calendar-year ranges for UI display.
const byId = {
  "pep-guardiola": career("เป๊ปสร้างทีมบาร์เซโลนาและแมนเชสเตอร์ ซิตี้ให้เป็นมหาอำนาจด้วยฟุตบอลครองบอลเชิงตำแหน่ง คว้าแชมป์ลีกและยุโรปจำนวนมาก.", [
    job(2007, 2008, "Barcelona B", "บาร์เซโลนา เบ", "manager"),
    job(2008, 2012, "Barcelona", "บาร์เซโลนา", "manager", ["La Liga ×3", "UCL ×2", "Copa del Rey ×2", "Club World Cup ×2"]),
    job(2013, 2016, "Bayern Munich", "บาเยิร์น มิวนิก", "manager", ["Bundesliga ×3", "DFB-Pokal ×2", "Club World Cup"]),
    job(2016, null, "Manchester City", "แมนเชสเตอร์ ซิตี้", "manager", ["Premier League ×6", "UCL", "FA Cup ×2", "Club World Cup"]),
  ]),
  "carlo-ancelotti": career("อันเชล็อตติเป็นกุนซือผู้ชนะยูฟ่าแชมเปียนส์ลีกมากที่สุด และคว้าแชมป์ลีกครบห้าลีกใหญ่ของยุโรป.", [
    job(1995, 1996, "Reggiana", "เรจเจียนา"), job(1996, 1998, "Parma", "ปาร์มา"),
    job(1999, 2001, "Juventus", "ยูเวนตุส"), job(2001, 2009, "AC Milan", "เอซี มิลาน", "manager", ["Serie A", "UCL ×2", "Club World Cup"]),
    job(2009, 2011, "Chelsea", "เชลซี", "manager", ["Premier League", "FA Cup"]), job(2011, 2013, "Paris Saint-Germain", "ปารีส แซงต์-แชร์กแมง", "manager", ["Ligue 1"]),
    job(2013, 2015, "Real Madrid", "เรอัล มาดริด", "manager", ["UCL", "Copa del Rey", "Club World Cup"]), job(2015, 2017, "Bayern Munich", "บาเยิร์น มิวนิก", "manager", ["Bundesliga"]),
    job(2018, 2019, "Napoli", "นาโปลี"), job(2019, 2021, "Everton", "เอฟเวอร์ตัน"),
    job(2021, 2025, "Real Madrid", "เรอัล มาดริด", "manager", ["La Liga ×2", "UCL ×2", "Copa del Rey", "Club World Cup"]),
    job(2025, null, "Brazil", "บราซิล", "national"),
  ]),
  "jose-mourinho": career("มูรินโญ่สร้างชื่อจากการพาปอร์โตคว้าแชมเปียนส์ลีก ก่อนคว้าแชมป์ใหญ่ในอังกฤษ อิตาลี และสเปน.", [
    job(2000, 2001, "Benfica", "เบนฟิกา"), job(2001, 2002, "União de Leiria", "อูเนียว เด เลเรีย"),
    job(2002, 2004, "Porto", "ปอร์โต", "manager", ["Primeira Liga ×2", "UEFA Cup", "UCL"]), job(2004, 2007, "Chelsea", "เชลซี", "manager", ["Premier League ×2", "FA Cup"]),
    job(2008, 2010, "Inter Milan", "อินเตอร์ มิลาน", "manager", ["Serie A ×2", "UCL", "Coppa Italia"]), job(2010, 2013, "Real Madrid", "เรอัล มาดริด", "manager", ["La Liga", "Copa del Rey"]),
    job(2013, 2015, "Chelsea", "เชลซี", "manager", ["Premier League", "League Cup"]), job(2016, 2018, "Manchester United", "แมนเชสเตอร์ ยูไนเต็ด", "manager", ["UEL", "League Cup"]),
    job(2019, 2021, "Tottenham Hotspur", "ท็อตแนม ฮ็อตสเปอร์"), job(2021, 2024, "Roma", "โรมา", "manager", ["UECL"]),
    job(2024, 2025, "Fenerbahçe", "เฟเนร์บาห์เช"), job(2025, null, "Benfica", "เบนฟิกา"),
  ]),
  "diego-simeone": career("ซิเมโอเนคุมแอตเลติโก มาดริดอย่างยาวนาน พาทีมคว้าแชมป์ลาลีกาสองสมัยและถ้วยยุโรป.", [
    job(2006, 2007, "Racing Club", "ราซิง คลับ"), job(2007, 2007, "Estudiantes", "เอสตูเดียนเตส"),
    job(2008, 2009, "River Plate", "ริเวอร์ เพลต"), job(2009, 2010, "San Lorenzo", "ซาน โลเรนโซ"),
    job(2011, null, "Atlético Madrid", "แอตเลติโก มาดริด", "manager", ["La Liga ×2", "UEL ×2", "Copa del Rey", "UEFA Super Cup ×2"]),
  ]),
  "antonio-conte": career("คอนเต้พาทีมคว้าแชมป์ลีกในอิตาลีและอังกฤษ โดดเด่นกับระบบหลังสามและวินัยเข้มข้น.", [
    job(2006, 2007, "Arezzo", "อาเรซโซ"), job(2007, 2009, "Bari", "บารี"), job(2009, 2010, "Atalanta", "อตาลันตา"),
    job(2011, 2014, "Juventus", "ยูเวนตุส", "manager", ["Serie A ×3"]), job(2014, 2016, "Italy", "อิตาลี", "national"),
    job(2016, 2018, "Chelsea", "เชลซี", "manager", ["Premier League", "FA Cup"]), job(2019, 2021, "Inter Milan", "อินเตอร์ มิลาน", "manager", ["Serie A"]),
    job(2021, 2023, "Tottenham Hotspur", "ท็อตแนม ฮ็อตสเปอร์"), job(2024, null, "Napoli", "นาโปลี", "manager", ["Serie A"]),
  ]),
  "jurgen-klopp": career("คล็อปป์ยกระดับดอร์ทมุนด์และลิเวอร์พูลด้วยเกเกนเพรสซิง พาลิเวอร์พูลกลับสู่แชมป์ลีกและยุโรป.", [
    job(2001, 2008, "Mainz 05", "ไมนซ์ 05"), job(2008, 2015, "Borussia Dortmund", "โบรุสเซีย ดอร์ทมุนด์", "manager", ["Bundesliga ×2", "DFB-Pokal"]),
    job(2015, 2024, "Liverpool", "ลิเวอร์พูล", "manager", ["Premier League", "UCL", "FA Cup", "League Cup ×2", "Club World Cup"]),
  ]),
  "mikel-arteta": career("อาร์เตตาเริ่มงานโค้ชกับแมนฯ ซิตี้ ก่อนสร้างอาร์เซนอลเป็นทีมลุ้นแชมป์พรีเมียร์ลีกด้วยเกมครองบอลและเพรสซิง.", [
    job(2016, 2019, "Manchester City", "แมนเชสเตอร์ ซิตี้", "assistant", ["Premier League ×2", "FA Cup"]), job(2019, null, "Arsenal", "อาร์เซนอล", "manager", ["FA Cup"]),
  ]),
  "arne-slot": career("สล็อตพาเฟเยนูร์ดคืนสู่แชมป์เอเรดิวิซี ก่อนคว้าแชมป์พรีเมียร์ลีกกับลิเวอร์พูลในฤดูกาลแรก.", [
    job(2017, 2019, "Cambuur", "คัมบูร์"), job(2019, 2021, "AZ Alkmaar", "อาแซด อัลค์มาร์"),
    job(2021, 2024, "Feyenoord", "เฟเยนูร์ด", "manager", ["Eredivisie", "KNVB Cup"]), job(2024, null, "Liverpool", "ลิเวอร์พูล", "manager", ["Premier League"]),
  ]),
  "xabi-alonso": career("อลอนโซสร้างผลงานประวัติศาสตร์พาเลเวอร์คูเซนคว้าดับเบิลในประเทศแบบไร้พ่าย ก่อนย้ายสู่เรอัล มาดริด.", [
    job(2018, 2019, "Real Madrid U14", "เรอัล มาดริด ยู14"), job(2019, 2022, "Real Sociedad B", "เรอัล โซเซียดัด เบ"),
    job(2022, 2025, "Bayer Leverkusen", "ไบเออร์ เลเวอร์คูเซน", "manager", ["Bundesliga", "DFB-Pokal"]), job(2025, null, "Real Madrid", "เรอัล มาดริด"),
  ]),
  "hansi-flick": career("ฟลิคคุมบาเยิร์นคว้าหกแชมป์ในปี 2020 ก่อนคุมเยอรมนีและบาร์เซโลนา.", [
    job(2000, 2005, "Hoffenheim", "ฮอฟเฟนไฮม์"), job(2006, 2014, "Germany", "เยอรมนี", "assistant", ["World Cup"]),
    job(2019, 2021, "Bayern Munich", "บาเยิร์น มิวนิก", "manager", ["Bundesliga ×2", "UCL", "DFB-Pokal", "Club World Cup"]),
    job(2021, 2023, "Germany", "เยอรมนี", "national"), job(2024, null, "Barcelona", "บาร์เซโลนา", "manager", ["La Liga", "Copa del Rey"]),
  ]),
  "thomas-tuchel": career("ทูเคิลคว้าแชมเปียนส์ลีกกับเชลซี และมีแชมป์ลีกกับปารีส แซงต์-แชร์กแมง तथाบาเยิร์น มิวนิก.", [
    job(2009, 2014, "Mainz 05", "ไมนซ์ 05"), job(2015, 2017, "Borussia Dortmund", "โบรุสเซีย ดอร์ทมุนด์", "manager", ["DFB-Pokal"]),
    job(2018, 2020, "Paris Saint-Germain", "ปารีส แซงต์-แชร์กแมง", "manager", ["Ligue 1 ×2", "Coupe de France"]),
    job(2021, 2022, "Chelsea", "เชลซี", "manager", ["UCL", "Club World Cup"]), job(2023, 2024, "Bayern Munich", "บาเยิร์น มิวนิก", "manager", ["Bundesliga"]),
    job(2025, null, "England", "อังกฤษ", "national"),
  ]),
  "julian-nagelsmann": career("นาเกิลส์มันน์เป็นกุนซือรุ่นใหม่ที่พาฮอฟเฟนไฮม์และไลป์ซิกเติบโต ก่อนคุมบาเยิร์นและทีมชาติเยอรมนี.", [
    job(2016, 2019, "Hoffenheim", "ฮอฟเฟนไฮม์"), job(2019, 2021, "RB Leipzig", "แอร์เบ ไลป์ซิก"),
    job(2021, 2023, "Bayern Munich", "บาเยิร์น มิวนิก", "manager", ["Bundesliga"]), job(2023, null, "Germany", "เยอรมนี", "national"),
  ]),
  "luis-enrique": career("หลุยส์ เอ็นรีเก้พาบาร์เซโลนาคว้าทริปเปิลแชมป์ และพาสเปนเข้ารอบลึกในรายการใหญ่ ก่อนคุมเปแอสเช.", [
    job(2008, 2011, "Barcelona B", "บาร์เซโลนา เบ"), job(2011, 2012, "Roma", "โรมา"), job(2013, 2014, "Celta Vigo", "เซลตา บีโก"),
    job(2014, 2017, "Barcelona", "บาร์เซโลนา", "manager", ["La Liga ×2", "UCL", "Copa del Rey ×3", "Club World Cup"]),
    job(2018, 2022, "Spain", "สเปน", "national"), job(2023, null, "Paris Saint-Germain", "ปารีส แซงต์-แชร์กแมง", "manager", ["Ligue 1 ×2", "UCL"]),
  ]),
  "unai-emery": career("เอเมรีคือผู้เชี่ยวชาญยูโรปาลีก คว้าถ้วยนี้สี่สมัยและพาแอสตัน วิลลาแข่งขันในยุโรป.", [
    job(2006, 2008, "Almería", "อัลเมเรีย"), job(2008, 2012, "Valencia", "บาเลนเซีย"), job(2012, 2013, "Spartak Moscow", "สปาร์ตัก มอสโก"),
    job(2013, 2016, "Sevilla", "เซบียา", "manager", ["UEL ×3"]), job(2016, 2018, "Paris Saint-Germain", "ปารีส แซงต์-แชร์กแมง", "manager", ["Ligue 1", "Coupe de France ×2"]),
    job(2018, 2019, "Arsenal", "อาร์เซนอล"), job(2020, 2022, "Villarreal", "บียาร์เรอัล", "manager", ["UEL"]),
    job(2022, null, "Aston Villa", "แอสตัน วิลลา"),
  ]),
  "ange-postecoglou": career("โปสเตโคกลูคว้าแชมป์ในออสเตรเลีย ญี่ปุ่น และสกอตแลนด์ ก่อนพาสเปอร์สคว้าแชมป์ยูโรปาลีก.", [
    job(1996, 2000, "South Melbourne", "เซาท์ เมลเบิร์น", "manager", ["National Soccer League ×2"]),
    job(2009, 2013, "Brisbane Roar", "บริสเบน รอร์", "manager", ["A-League ×2"]), job(2013, 2017, "Australia", "ออสเตรเลีย", "national", ["Asian Cup"]),
    job(2018, 2021, "Yokohama F. Marinos", "โยโกฮามา เอฟ มารินอส", "manager", ["J1 League"]), job(2021, 2023, "Celtic", "เซลติก", "manager", ["Scottish Premiership ×2", "Scottish Cup"]),
    job(2023, 2025, "Tottenham Hotspur", "ท็อตแนม ฮ็อตสเปอร์", "manager", ["UEL"]), job(2025, null, "Nottingham Forest", "น็อตติงแฮม ฟอเรสต์"),
  ]),
  "ruben-amorim": career("อโมริมพาสปอร์ติ้งคว้าแชมป์โปรตุเกสสองสมัย ก่อนรับงานคุมแมนเชสเตอร์ ยูไนเต็ด.", [
    job(2018, 2020, "Braga", "บรากา", "manager", ["Taça da Liga"]), job(2020, 2024, "Sporting CP", "สปอร์ติ้ง ลิสบอน", "manager", ["Primeira Liga ×2", "Taça da Liga ×2"]),
    job(2024, null, "Manchester United", "แมนเชสเตอร์ ยูไนเต็ด", "manager", ["UEL"]),
  ]),
  "enzo-maresca": career("มาเรสก้าทำงานเป็นผู้ช่วยของกวาร์ดิโอลา ก่อนพาเลสเตอร์เลื่อนชั้นและคุมเชลซีคว้าแชมป์ยุโรป.", [
    job(2017, 2018, "Ascoli", "อัสโคลี"), job(2020, 2021, "Manchester City U23", "แมนเชสเตอร์ ซิตี้ ยู23"),
    job(2021, 2022, "Parma", "ปาร์มา"), job(2022, 2023, "Manchester City", "แมนเชสเตอร์ ซิตี้", "assistant", ["Premier League", "UCL"]),
    job(2023, 2024, "Leicester City", "เลสเตอร์ ซิตี้", "manager", ["EFL Championship"]), job(2024, null, "Chelsea", "เชลซี", "manager", ["UECL"]),
  ]),
  "vincent-kompany": career("กอมปานีพาเบิร์นลีย์คว้าแชมป์แชมเปียนชิพ ก่อนก้าวสู่บาเยิร์น มิวนิก.", [
    job(2020, 2022, "Anderlecht", "อันเดอร์เลชท์"), job(2022, 2024, "Burnley", "เบิร์นลีย์", "manager", ["EFL Championship"]),
    job(2024, null, "Bayern Munich", "บาเยิร์น มิวนิก", "manager", ["Bundesliga"]),
  ]),
  "roberto-de-zerbi": career("เด แซร์บีมีชื่อจากฟุตบอลสร้างเกมของซาสซูโอโล ไบรท์ตัน และมาร์กเซย.", [
    job(2013, 2016, "Foggia", "ฟอจจา"), job(2016, 2017, "Palermo", "ปาแลร์โม"), job(2017, 2018, "Benevento", "เบเนเวนโต"),
    job(2018, 2021, "Sassuolo", "ซาสซูโอโล"), job(2021, 2022, "Shakhtar Donetsk", "ชัคตาร์ โดเนตส์ก", "manager", ["Ukrainian Super Cup"]),
    job(2022, 2024, "Brighton & Hove Albion", "ไบรท์ตัน"), job(2024, null, "Marseille", "มาร์กเซย"),
  ]),
  "erik-ten-hag": career("เทน ฮากพาอาแจ็กซ์คว้าแชมป์ลีกสามสมัย ก่อนคุมแมนเชสเตอร์ ยูไนเต็ดและไบเออร์ เลเวอร์คูเซน.", [
    job(2012, 2013, "Go Ahead Eagles", "โก อเฮด อีเกิลส์"), job(2013, 2015, "Bayern Munich II", "บาเยิร์น มิวนิก เบ"),
    job(2015, 2017, "Utrecht", "อูเทรคต์"), job(2017, 2022, "Ajax", "อาแจ็กซ์", "manager", ["Eredivisie ×3", "KNVB Cup ×2"]),
    job(2022, 2024, "Manchester United", "แมนเชสเตอร์ ยูไนเต็ด", "manager", ["FA Cup", "League Cup"]), job(2025, null, "Bayer Leverkusen", "ไบเออร์ เลเวอร์คูเซน"),
  ]),
  "massimiliano-allegri": career("อัลเลกรีคว้าแชมป์เซเรียอาหกครั้งกับเอซี มิลานและยูเวนตุส และพาทีมเข้าชิงแชมเปียนส์ลีกสองหน.", [
    job(2007, 2008, "Sassuolo", "ซาสซูโอโล"), job(2008, 2010, "Cagliari", "กายารี"), job(2010, 2014, "AC Milan", "เอซี มิลาน", "manager", ["Serie A"]),
    job(2014, 2019, "Juventus", "ยูเวนตุส", "manager", ["Serie A ×5", "Coppa Italia ×4"]), job(2021, 2024, "Juventus", "ยูเวนตุส", "manager", ["Coppa Italia"]),
    job(2025, null, "AC Milan", "เอซี มิลาน"),
  ]),
  "simone-inzaghi": career("อินซากีพาลาซิโอและอินเตอร์ประสบความสำเร็จในบอลถ้วย ก่อนพาอินเตอร์คว้าแชมป์เซเรียอา.", [
    job(2016, 2021, "Lazio", "ลาซิโอ", "manager", ["Coppa Italia", "Supercoppa Italiana ×2"]), job(2021, 2025, "Inter Milan", "อินเตอร์ มิลาน", "manager", ["Serie A", "Coppa Italia ×2", "Supercoppa Italiana ×3"]),
    job(2025, null, "Al-Hilal", "อัล ฮิลาล"),
  ]),
  "luciano-spalletti": career("สปัลเล็ตติเป็นกุนซือผู้พานาโปลีคว้าเซเรียอาครั้งประวัติศาสตร์ ก่อนคุมทีมชาติอิตาลี.", [
    job(1995, 1998, "Empoli", "เอ็มโปลี"), job(1998, 2005, "Udinese", "อูดิเนเซ"), job(2005, 2009, "Roma", "โรมา", "manager", ["Coppa Italia ×2"]),
    job(2009, 2014, "Zenit Saint Petersburg", "เซนิต เซนต์ปีเตอร์สเบิร์ก", "manager", ["Russian Premier League ×2"]), job(2016, 2017, "Roma", "โรมา"),
    job(2017, 2019, "Inter Milan", "อินเตอร์ มิลาน"), job(2021, 2023, "Napoli", "นาโปลี", "manager", ["Serie A"]), job(2023, 2025, "Italy", "อิตาลี", "national"),
  ]),
  "maurizio-sarri": career("ซาร์รีพานาโปลีเล่นฟุตบอลครองบอลโดดเด่น ก่อนคว้ายูโรปาลีกกับเชลซีและเซเรียอากับยูเวนตุส.", [
    job(2012, 2015, "Empoli", "เอ็มโปลี"), job(2015, 2018, "Napoli", "นาโปลี"), job(2018, 2019, "Chelsea", "เชลซี", "manager", ["UEL"]),
    job(2019, 2020, "Juventus", "ยูเวนตุส", "manager", ["Serie A"]), job(2021, 2024, "Lazio", "ลาซิโอ"), job(2025, null, "Lazio", "ลาซิโอ"),
  ]),
  "gian-piero-gasperini": career("กัสเปรินีสร้างอตาลันตาเป็นทีมแชมเปียนส์ลีกและพาทีมคว้าแชมป์ยูโรปาลีก 2024.", [
    job(2003, 2006, "Crotone", "โครโตเน"), job(2006, 2010, "Genoa", "เจนัว"), job(2011, 2011, "Inter Milan", "อินเตอร์ มิลาน"),
    job(2016, 2025, "Atalanta", "อตาลันตา", "manager", ["UEL"]), job(2025, null, "Roma", "โรมา"),
  ]),
  "stefano-pioli": career("ปิโอลีพาเอซี มิลานคว้าเซเรียอา 2022 และต่อมาคุมอัล นาสเซอร์.", [
    job(2007, 2009, "Piacenza", "ปิอาเชนซา"), job(2011, 2014, "Bologna", "โบโลญญา"), job(2014, 2016, "Lazio", "ลาซิโอ"),
    job(2017, 2019, "Fiorentina", "ฟิออเรนตินา"), job(2019, 2024, "AC Milan", "เอซี มิลาน", "manager", ["Serie A"]), job(2024, null, "Al-Nassr", "อัล นาสเซอร์"),
  ]),
  "rafael-benitez": career("เบนิเตซคว้าแชมเปียนส์ลีกกับลิเวอร์พูลและยูโรปาลีกสองสมัย มีประสบการณ์คุมทีมทั่วยุโรป.", [
    job(2001, 2004, "Valencia", "บาเลนเซีย", "manager", ["La Liga ×2", "UEFA Cup"]), job(2004, 2010, "Liverpool", "ลิเวอร์พูล", "manager", ["UCL", "FA Cup"]),
    job(2010, 2012, "Inter Milan", "อินเตอร์ มิลาน", "manager", ["Club World Cup"]), job(2012, 2013, "Chelsea", "เชลซี", "interim", ["UEL"]),
    job(2013, 2015, "Napoli", "นาโปลี", "manager", ["Coppa Italia"]), job(2015, 2016, "Real Madrid", "เรอัล มาดริด"), job(2016, 2019, "Newcastle United", "นิวคาสเซิล ยูไนเต็ด"),
    job(2019, 2021, "Dalian Professional", "ต้าเหลียน โปรเฟสชันแนล"), job(2021, 2022, "Everton", "เอฟเวอร์ตัน"), job(2023, 2024, "Celta Vigo", "เซลตา บีโก"),
  ]),
  "manuel-pellegrini": career("เปเยกรินีพาแมนเชสเตอร์ ซิตี้คว้าแชมป์พรีเมียร์ลีก และคุมเรอัล เบติสคว้าโกปา เดล เรย์.", [
    job(2004, 2009, "Villarreal", "บียาร์เรอัล"), job(2009, 2010, "Real Madrid", "เรอัล มาดริด"), job(2010, 2013, "Málaga", "มาลากา"),
    job(2013, 2016, "Manchester City", "แมนเชสเตอร์ ซิตี้", "manager", ["Premier League", "League Cup ×2"]), job(2016, 2018, "Hebei China Fortune", "เหอเป่ย ไชน่า ฟอร์จูน"),
    job(2018, 2019, "West Ham United", "เวสต์แฮม ยูไนเต็ด"), job(2020, null, "Real Betis", "เรอัล เบติส", "manager", ["Copa del Rey"]),
  ]),
  "marcelo-bielsa": career("บิเอลซาคือกุนซือผู้ทรงอิทธิพลด้านการเพรสซิง เคยคุมอาร์เจนตินา ชิลี และพาลีดส์เลื่อนชั้น.", [
    job(1990, 1998, "Newell's Old Boys", "นีเวลล์ส โอลด์บอยส์", "manager", ["Argentine Primera División ×2"]), job(1998, 2004, "Argentina", "อาร์เจนตินา", "national", ["Olympic Gold"]),
    job(2007, 2011, "Chile", "ชิลี", "national"), job(2011, 2013, "Athletic Club", "แอธเลติก บิลเบา"), job(2014, 2015, "Marseille", "มาร์กเซย"),
    job(2018, 2022, "Leeds United", "ลีดส์ ยูไนเต็ด", "manager", ["EFL Championship"]), job(2023, null, "Uruguay", "อุรุกวัย", "national"),
  ]),
  "fernando-diniz": career("ดินิซโดดเด่นด้วยฟุตบอลครองบอลแบบสัมพันธ์ตำแหน่ง และพาฟลูมิเนนเซคว้าโคปา ลิเบอร์ตาดอเรส.", [
    job(2016, 2018, "Audax", "อูแด็กซ์"), job(2018, 2019, "Fluminense", "ฟลูมิเนนเซ"), job(2019, 2021, "São Paulo", "เซาเปาโล"),
    job(2022, 2024, "Fluminense", "ฟลูมิเนนเซ", "manager", ["Copa Libertadores", "Recopa Sudamericana"]), job(2023, 2024, "Brazil", "บราซิล", "interim"),
  ]),
  "tite": career("ตีเต้พาโครินเธียนส์คว้าลิเบอร์ตาดอเรสและสโมสรโลก ก่อนพาบราซิลคว้าโคปา อเมริกา.", [
    job(2004, 2005, "Grêmio", "เกรมิโอ"), job(2008, 2010, "Internacional", "อินเตอร์นาซิอองนาล", "manager", ["Copa Sudamericana"]),
    job(2010, 2013, "Corinthians", "โครินเธียนส์", "manager", ["Copa Libertadores", "Club World Cup"]), job(2016, 2022, "Brazil", "บราซิล", "national", ["Copa América"]),
    job(2023, 2024, "Flamengo", "ฟลาเมงโก"),
  ]),
  "abel-ferreira": career("อาเบล เฟร์เรย์ราพาพัลไมรัสคว้าโคปา ลิเบอร์ตาดอเรสสองสมัยและแชมป์บราซิล.", [
    job(2017, 2019, "Braga", "บรากา"), job(2019, 2020, "PAOK", "พีเอโอเค"), job(2020, null, "Palmeiras", "พัลไมรัส", "manager", ["Copa Libertadores ×2", "Brasileirão Série A ×2", "Recopa Sudamericana"]),
  ]),
  "jorge-jesus": career("จอร์จ เชซุสคว้าแชมป์กับเบนฟิกาและฟลาเมงโก รวมถึงลิเบอร์ตาดอเรส 2019.", [
    job(2009, 2015, "Benfica", "เบนฟิกา", "manager", ["Primeira Liga ×3", "Taça de Portugal", "UEL"]), job(2015, 2018, "Sporting CP", "สปอร์ติ้ง ลิสบอน"),
    job(2019, 2020, "Flamengo", "ฟลาเมงโก", "manager", ["Brasileirão Série A", "Copa Libertadores"]), job(2020, 2021, "Benfica", "เบนฟิกา"),
    job(2022, 2023, "Fenerbahçe", "เฟเนร์บาห์เช"), job(2023, 2025, "Al-Hilal", "อัล ฮิลาล", "manager", ["Saudi Pro League"]), job(2025, null, "Al-Nassr", "อัล นาสเซอร์"),
  ]),
  "leonardo-jardim": career("ชาร์ดิมพาโมนาโกคว้าแชมป์ลีกเอิง 2017 และทำงานในหลายลีกยุโรปกับตะวันออกกลาง.", [
    job(2011, 2012, "Braga", "บรากา"), job(2012, 2013, "Olympiacos", "โอลิมเปียกอส", "manager", ["Greek Super League"]),
    job(2013, 2014, "Sporting CP", "สปอร์ติ้ง ลิสบอน"), job(2014, 2018, "Monaco", "โมนาโก", "manager", ["Ligue 1"]),
    job(2018, 2020, "Monaco", "โมนาโก"), job(2020, 2021, "Al-Hilal", "อัล ฮิลาล", "manager", ["AFC Champions League"]), job(2021, 2022, "Al-Ahli", "อัล อาห์ลี"),
    job(2023, 2024, "Al-Rayyan", "อัล รายยาน"), job(2024, null, "Cruzeiro", "ครูไซโร"),
  ]),
  "zinedine-zidane": career("ซีดานคุมเรอัล มาดริดคว้าแชมเปียนส์ลีกสามสมัยติดต่อกัน และแชมป์ลาลีกาสองครั้ง.", [
    job(2014, 2016, "Real Madrid Castilla", "เรอัล มาดริด กัสติยา"), job(2016, 2018, "Real Madrid", "เรอัล มาดริด", "manager", ["UCL ×3", "La Liga", "Club World Cup ×2"]),
    job(2019, 2021, "Real Madrid", "เรอัล มาดริด", "manager", ["La Liga"]),
  ]),
  "didier-deschamps": career("เดชองส์พาฝรั่งเศสคว้าแชมป์ฟุตบอลโลก 2018 และเนชันส์ลีก 2021.", [
    job(2001, 2005, "Monaco", "โมนาโก", "manager", ["Coupe de la Ligue"]), job(2006, 2009, "Juventus", "ยูเวนตุส"),
    job(2009, 2012, "Marseille", "มาร์กเซย", "manager", ["Ligue 1", "Coupe de la Ligue ×3"]), job(2012, null, "France", "ฝรั่งเศส", "national", ["World Cup", "Nations League"]),
  ]),
  "franck-haise": career("แอสพาเลนส์กลับสู่ลีกเอิงและพาทีมไปแชมเปียนส์ลีก ก่อนย้ายไปคุมนีซ.", [
    job(2020, 2024, "Lens", "ล็องส์"), job(2024, null, "Nice", "นีซ"),
  ]),
  "luis-de-la-fuente": career("เด ลา ฟวนเต้พาสเปนคว้าแชมป์ยูโร 2024 หลังประสบความสำเร็จกับทีมเยาวชนชาติสเปน.", [
    job(2013, 2018, "Spain U19/U21", "สเปน ยู19/ยู21", "national", ["UEFA U19 Championship", "UEFA U21 Championship"]), job(2022, null, "Spain", "สเปน", "national", ["Euros", "Nations League"]),
  ]),
  "lionel-scaloni": career("สกาโลนีพาอาร์เจนตินาคว้าโคปา อเมริกาสองครั้ง ฟุตบอลโลก 2022 และฟินาลิสซิมา.", [
    job(2017, 2018, "Argentina", "อาร์เจนตินา", "assistant"), job(2018, null, "Argentina", "อาร์เจนตินา", "national", ["Copa América ×2", "World Cup", "Finalissima"]),
  ]),
  "ralf-rangnick": career("รังนิคเป็นผู้วางรากฐานฟุตบอลเพรสซิงเยอรมัน เคยคุมชาลเก้ แมนฯ ยูไนเต็ดชั่วคราว และออสเตรีย.", [
    job(1995, 1999, "Ulm", "อูล์ม"), job(1999, 2001, "VfB Stuttgart", "สตุตการ์ต"), job(2004, 2005, "Schalke 04", "ชาลเก้ 04", "manager", ["DFB-Pokal"]),
    job(2006, 2011, "Hoffenheim", "ฮอฟเฟนไฮม์"), job(2011, 2011, "Schalke 04", "ชาลเก้ 04", "manager", ["DFB-Pokal"]), job(2021, 2022, "Manchester United", "แมนเชสเตอร์ ยูไนเต็ด", "interim"),
    job(2022, null, "Austria", "ออสเตรีย", "national"),
  ]),
  "nuno-espirito-santo": career("นูโน่พาวูล์ฟส์เลื่อนชั้นและไปเล่นยุโรป ก่อนคุมฟอเรสต์และคว้าแชมป์เอเอฟซีแชมเปียนส์ลีกกับอัล อิตติฮัด.", [
    job(2014, 2016, "Valencia", "บาเลนเซีย"), job(2016, 2017, "Porto", "ปอร์โต"), job(2017, 2021, "Wolverhampton Wanderers", "วูล์ฟแฮมป์ตัน", "manager", ["EFL Championship"]),
    job(2021, 2021, "Tottenham Hotspur", "ท็อตแนม ฮ็อตสเปอร์"), job(2022, 2023, "Al-Ittihad", "อัล อิตติฮัด", "manager", ["Saudi Pro League"]),
    job(2023, null, "Nottingham Forest", "น็อตติงแฮม ฟอเรสต์"),
  ]),
  "david-moyes": career("มอยส์สร้างเอฟเวอร์ตันให้เป็นทีมยุโรป และพาเวสต์แฮมคว้าแชมป์คอนเฟอเรนซ์ลีก.", [
    job(1998, 2002, "Preston North End", "เพรสตัน นอร์ท เอนด์"), job(2002, 2013, "Everton", "เอฟเวอร์ตัน"),
    job(2013, 2014, "Manchester United", "แมนเชสเตอร์ ยูไนเต็ด", "manager", ["Community Shield"]), job(2014, 2016, "Real Sociedad", "เรอัล โซเซียดัด"),
    job(2017, 2018, "West Ham United", "เวสต์แฮม ยูไนเต็ด"), job(2019, 2024, "West Ham United", "เวสต์แฮม ยูไนเต็ด", "manager", ["UECL"]), job(2025, null, "Everton", "เอฟเวอร์ตัน"),
  ]),
  "sean-dyche": career("ไดช์พาเบิร์นลีย์เลื่อนชั้นและอยู่พรีเมียร์ลีกยาวนาน ก่อนคุมเอฟเวอร์ตัน.", [
    job(2011, 2012, "Watford", "วัตฟอร์ด"), job(2012, 2022, "Burnley", "เบิร์นลีย์", "manager", ["EFL Championship ×2"]), job(2023, 2025, "Everton", "เอฟเวอร์ตัน"),
  ]),
  "eddie-howe": career("ฮาวพาบอร์นมัธจากลีกล่างสู่พรีเมียร์ลีก ก่อนพานิวคาสเซิลคว้าแชมป์ลีกคัพ.", [
    job(2008, 2011, "Bournemouth", "บอร์นมัธ"), job(2011, 2012, "Burnley", "เบิร์นลีย์"), job(2012, 2020, "Bournemouth", "บอร์นมัธ", "manager", ["EFL Championship"]),
    job(2021, null, "Newcastle United", "นิวคาสเซิล ยูไนเต็ด", "manager", ["League Cup"]),
  ]),
  "andoni-iraola": career("อิราโอลาพาราโย บาเยกาโนขึ้นลาลีกา ก่อนสร้างบอร์นมัธเป็นทีมเพรสซิงที่แข็งแกร่ง.", [
    job(2018, 2020, "Mirandés", "มิรันเดส"), job(2020, 2023, "Rayo Vallecano", "ราโย บาเยกาโน"), job(2023, null, "Bournemouth", "บอร์นมัธ"),
  ]),
  "graham-potter": career("พอตเตอร์สร้างชื่อกับเอิสเตอร์ซุนด์และไบรท์ตัน ก่อนคุมเชลซีและเวสต์แฮม.", [
    job(2011, 2018, "Östersund", "เอิสเตอร์ซุนด์", "manager", ["Svenska Cupen"]), job(2018, 2022, "Brighton & Hove Albion", "ไบรท์ตัน"),
    job(2022, 2023, "Chelsea", "เชลซี"), job(2025, null, "West Ham United", "เวสต์แฮม ยูไนเต็ด"),
  ]),
  "marco-silva": career("มาร์โก ซิลวาคว้าแชมป์กรีซกับโอลิมเปียกอส ก่อนคุมสโมสรพรีเมียร์ลีกหลายแห่งและฟูแล่ม.", [
    job(2011, 2014, "Estoril", "เอสโตริล"), job(2014, 2015, "Sporting CP", "สปอร์ติ้ง ลิสบอน"), job(2015, 2016, "Olympiacos", "โอลิมเปียกอส", "manager", ["Greek Super League"]),
    job(2017, 2017, "Hull City", "ฮัลล์ ซิตี้"), job(2017, 2018, "Watford", "วัตฟอร์ด"), job(2018, 2019, "Everton", "เอฟเวอร์ตัน"), job(2021, null, "Fulham", "ฟูแล่ม", "manager", ["EFL Championship"]),
  ]),
  "oliver-glasner": career("กลาสเนอร์พาแฟรงก์เฟิร์ตคว้ายูโรปาลีก และพาคริสตัล พาเลซคว้าเอฟเอคัพ.", [
    job(2015, 2019, "LASK", "แอลเอเอสเค"), job(2019, 2021, "Wolfsburg", "โวล์ฟสบวร์ก"), job(2021, 2023, "Eintracht Frankfurt", "ไอน์ทรัคท์ แฟรงก์เฟิร์ต", "manager", ["UEL"]),
    job(2024, null, "Crystal Palace", "คริสตัล พาเลซ", "manager", ["FA Cup"]),
  ]),
  "thomas-frank": career("แฟรงก์พาเบรนท์ฟอร์ดเลื่อนชั้นสู่พรีเมียร์ลีก และสร้างทีมที่วิเคราะห์คู่แข่งกับลูกตั้งเตะเด่น.", [
    job(2013, 2016, "Denmark U16/U17", "เดนมาร์ก ยู16/ยู17", "national"), job(2018, 2025, "Brentford", "เบรนท์ฟอร์ด", "manager", ["EFL Championship"]),
    job(2025, null, "Tottenham Hotspur", "ท็อตแนม ฮ็อตสเปอร์"),
  ]),
  "fabian-hurzeler": career("เฮอร์เซเลอร์พาแซงต์ เพาลีเลื่อนชั้นสู่บุนเดสลีกา ก่อนเป็นกุนซือพรีเมียร์ลีกอายุน้อยที่สุดกับไบรท์ตัน.", [
    job(2023, 2024, "St. Pauli", "ซังต์ เพาลี", "manager", ["2. Bundesliga"]), job(2024, null, "Brighton & Hove Albion", "ไบรท์ตัน"),
  ]),
  "kieran-mckenna": career("แม็คเคนนาพาอิปสวิชเลื่อนชั้นติดต่อกันจากลีกวันสู่พรีเมียร์ลีก.", [
    job(2016, 2021, "Manchester United", "แมนเชสเตอร์ ยูไนเต็ด", "assistant"), job(2021, null, "Ipswich Town", "อิปสวิช ทาวน์", "manager", ["League One", "EFL Championship"]),
  ]),
  "roberto-martinez": career("มาร์ติเนซคุมวีแกนคว้าเอฟเอคัพ และพาเบลเยียมจบอันดับสามฟุตบอลโลก ก่อนคุมโปรตุเกส.", [
    job(2007, 2009, "Swansea City", "สวอนซี ซิตี้"), job(2009, 2013, "Wigan Athletic", "วีแกน แอธเลติก", "manager", ["FA Cup"]),
    job(2013, 2016, "Everton", "เอฟเวอร์ตัน"), job(2016, 2022, "Belgium", "เบลเยียม", "national"), job(2023, null, "Portugal", "โปรตุเกส", "national", ["Nations League"]),
  ]),
  "ronald-koeman": career("คูมันคว้าแชมป์ลีกกับอาแจ็กซ์ พีเอสวี และบาร์เซโลนา ก่อนกลับมาคุมทีมชาติเนเธอร์แลนด์.", [
    job(2001, 2005, "Ajax", "อาแจ็กซ์", "manager", ["Eredivisie ×2", "KNVB Cup"]), job(2006, 2007, "PSV", "พีเอสวี", "manager", ["Eredivisie"]),
    job(2007, 2009, "Valencia", "บาเลนเซีย", "manager", ["Copa del Rey"]), job(2014, 2016, "Southampton", "เซาแธมป์ตัน"), job(2016, 2018, "Everton", "เอฟเวอร์ตัน"),
    job(2018, 2020, "Netherlands", "เนเธอร์แลนด์", "national"), job(2020, 2021, "Barcelona", "บาร์เซโลนา", "manager", ["Copa del Rey"]), job(2023, null, "Netherlands", "เนเธอร์แลนด์", "national"),
  ]),
  "hajime-moriyasu": career("โมริยาสุพาซานเฟรชเชคว้าเจลีก ก่อนพาญี่ปุ่นไปฟุตบอลโลกรอบน็อกเอาต์สองครั้ง.", [
    job(2012, 2017, "Sanfrecce Hiroshima", "ซานเฟรชเช ฮิโรชิมา", "manager", ["J1 League ×3"]), job(2018, null, "Japan", "ญี่ปุ่น", "national"),
  ]),
  "masatada-ishii": career("อิชอิพาคาชิมา แอนต์เลอร์สคว้าเจลีก ก่อนคุมทีมชาติไทยและบุรีรัมย์ ยูไนเต็ด.", [
    job(2015, 2017, "Kashima Antlers", "คาชิมา แอนต์เลอร์ส", "manager", ["J1 League", "Emperor's Cup"]), job(2019, 2021, "Samut Prakan City", "สมุทรปราการ ซิตี้"),
    job(2021, 2023, "Buriram United", "บุรีรัมย์ ยูไนเต็ด", "manager", ["Thai League 1 ×2", "Thai FA Cup ×2"]), job(2023, null, "Thailand", "ไทย", "national"),
  ]),
  "alexandre-gesteira": career("มาโน เมเนเซสพาโครินเธียนส์คว้าแชมป์โคปา เดล เรย์บราซิล และเคยคุมทีมชาติบราซิล.", [
    job(2005, 2007, "Guarani", "กวารานี"), job(2008, 2010, "Corinthians", "โครินเธียนส์", "manager", ["Copa do Brasil", "Série B"]),
    job(2010, 2012, "Brazil", "บราซิล", "national"), job(2013, 2014, "Corinthians", "โครินเธียนส์", "manager", ["Recopa Sudamericana"]),
    job(2015, 2016, "Cruzeiro", "ครูไซโร", "manager", ["Copa do Brasil"]), job(2017, 2019, "Cruzeiro", "ครูไซโร"), job(2024, 2025, "Fluminense", "ฟลูมิเนนเซ"),
  ]),
  "mauricio-pochettino": career("โปเช็ตติโนพาสเปอร์สเข้าชิงแชมเปียนส์ลีก ก่อนคุมเปแอสเช เชลซี และทีมชาติสหรัฐฯ.", [
    job(2009, 2012, "Espanyol", "เอสปันญอล"), job(2013, 2014, "Southampton", "เซาแธมป์ตัน"), job(2014, 2019, "Tottenham Hotspur", "ท็อตแนม ฮ็อตสเปอร์"),
    job(2021, 2022, "Paris Saint-Germain", "ปารีส แซงต์-แชร์กแมง", "manager", ["Ligue 1", "Coupe de France"]), job(2023, 2024, "Chelsea", "เชลซี"), job(2024, null, "United States", "สหรัฐอเมริกา", "national"),
  ]),
  "antonio-conte-2": career("ติอาโก ม็อตต้าพาโบโลญญาไปแชมเปียนส์ลีก ก่อนรับงานคุมยูเวนตุส.", [
    job(2018, 2019, "PSG U19", "เปแอสเช ยู19"), job(2019, 2019, "Genoa", "เจนัว"), job(2021, 2022, "Spezia", "สเปเซีย"),
    job(2022, 2024, "Bologna", "โบโลญญา"), job(2024, 2025, "Juventus", "ยูเวนตุส"),
  ]),
  "sergio-conceicao": career("คอนไซเซาพาปอร์โตคว้าแชมป์ลีกสามครั้งและบอลถ้วยหลายรายการ ก่อนคุมเอซี มิลาน.", [
    job(2012, 2013, "Olhanense", "โอลญาเนนเซ"), job(2014, 2016, "Braga", "บรากา"), job(2016, 2017, "Nantes", "น็องต์"),
    job(2017, 2024, "Porto", "ปอร์โต", "manager", ["Primeira Liga ×3", "Taça de Portugal ×4"]), job(2024, 2025, "AC Milan", "เอซี มิลาน", "manager", ["Supercoppa Italiana"]),
  ]),
  "paulo-fonseca": career("ฟอนเซก้าคว้าแชมป์ยูเครนกับชัคตาร์ ก่อนคุมโรมา ลีลล์ เอซี มิลาน และลียง.", [
    job(2012, 2013, "Paços de Ferreira", "ปาซอส เด แฟร์เรรา"), job(2013, 2015, "Porto", "ปอร์โต"), job(2016, 2019, "Shakhtar Donetsk", "ชัคตาร์ โดเนตส์ก", "manager", ["Ukrainian Premier League ×3", "Ukrainian Cup ×3"]),
    job(2019, 2021, "Roma", "โรมา"), job(2022, 2024, "Lille", "ลีลล์"), job(2024, 2025, "AC Milan", "เอซี มิลาน"), job(2025, null, "Lyon", "ลียง"),
  ]),
  "ivan-juric": career("ยูริชยึดแนวทางเพรสซิงแบบกัสเปรินี และคุมเวโรนา โตริโน โรมา เซาแธมป์ตัน และอตาลันตา.", [
    job(2016, 2018, "Genoa", "เจนัว"), job(2018, 2019, "Verona", "เวโรนา"), job(2021, 2024, "Torino", "โตริโน"),
    job(2024, 2024, "Roma", "โรมา"), job(2024, 2025, "Southampton", "เซาแธมป์ตัน"), job(2025, null, "Atalanta", "อตาลันตา"),
  ]),
  "claudio-ranieri": career("ราเนียรีมีอาชีพยาวนานทั่วยุโรป และสร้างปาฏิหาริย์พาเลสเตอร์คว้าแชมป์พรีเมียร์ลีก 2016.", [
    job(1993, 1997, "Fiorentina", "ฟิออเรนตินา", "manager", ["Coppa Italia"]), job(1997, 1999, "Valencia", "บาเลนเซีย", "manager", ["Copa del Rey"]),
    job(2000, 2004, "Chelsea", "เชลซี"), job(2007, 2009, "Juventus", "ยูเวนตุส"), job(2009, 2011, "Roma", "โรมา"),
    job(2015, 2017, "Leicester City", "เลสเตอร์ ซิตี้", "manager", ["Premier League"]), job(2017, 2018, "Nantes", "น็องต์"), job(2018, 2019, "Fulham", "ฟูแล่ม"),
    job(2019, 2021, "Sampdoria", "ซามพ์โดเรีย"), job(2024, null, "Roma", "โรมา"),
  ]),
  "carlo-ancelotti-assist": career("ฟาริโอลีเป็นกุนซืออิตาลีรุ่นใหม่ที่เริ่มจากตุรกี ก่อนคุมนีซและอาแจ็กซ์.", [
    job(2021, 2023, "Fatih Karagümrük", "ฟาติห์ คารากุมรุก"), job(2023, 2024, "Nice", "นีซ"), job(2024, null, "Ajax", "อาแจ็กซ์"),
  ]),
  "arner-slot-rival": career("บอสซ์เป็นกุนซือเกมรุกที่คุมอาแจ็กซ์ ดอร์ทมุนด์ ลียง และพาพีเอสวีคว้าแชมป์เอเรดิวิซี.", [
    job(2013, 2016, "Vitesse", "วิเทสส์"), job(2016, 2017, "Ajax", "อาแจ็กซ์"), job(2017, 2017, "Borussia Dortmund", "โบรุสเซีย ดอร์ทมุนด์"),
    job(2019, 2021, "Bayer Leverkusen", "ไบเออร์ เลเวอร์คูเซน"), job(2021, 2023, "Lyon", "ลียง"), job(2023, null, "PSV", "พีเอสวี", "manager", ["Eredivisie"]),
  ]),
  "bruno-lage": career("ลาจพาเบนฟิกาคว้าแชมป์โปรตุเกส ก่อนคุมวูล์ฟส์และกลับมาคุมเบนฟิกา.", [
    job(2019, 2020, "Benfica", "เบนฟิกา", "manager", ["Primeira Liga"]), job(2021, 2022, "Wolverhampton Wanderers", "วูล์ฟแฮมป์ตัน"), job(2023, 2024, "Botafogo", "โบตาโฟโก"), job(2024, null, "Benfica", "เบนฟิกา"),
  ]),
  "vitor-pereira": career("วิตอร์ เปเรย์ราคว้าแชมป์ลีกโปรตุเกสกับปอร์โต และทำงานในกรีซ จีน ตุรกี และบราซิล.", [
    job(2011, 2013, "Porto", "ปอร์โต", "manager", ["Primeira Liga ×2"]), job(2013, 2015, "Al-Ahli", "อัล อาห์ลี"),
    job(2015, 2016, "Olympiacos", "โอลิมเปียกอส", "manager", ["Greek Super League"]), job(2017, 2020, "Shanghai SIPG", "เซี่ยงไฮ้ เอสไอพีจี", "manager", ["Chinese Super League"]),
    job(2021, 2021, "Fenerbahçe", "เฟเนร์บาห์เช"), job(2022, 2023, "Flamengo", "ฟลาเมงโก"), job(2024, null, "Wolverhampton Wanderers", "วูล์ฟแฮมป์ตัน"),
  ]),
  "jess-marsch": career("เจสซี มาร์ชคว้าแชมป์ออสเตรียกับซัลซ์บวร์ก ก่อนคุมไลป์ซิก ลีดส์ และทีมชาติแคนาดา.", [
    job(2015, 2018, "New York Red Bulls", "นิวยอร์ก เรดบูลส์", "manager", ["Supporters' Shield"]), job(2018, 2021, "Red Bull Salzburg", "เรดบูล ซัลซ์บวร์ก", "manager", ["Austrian Bundesliga ×2"]),
    job(2021, 2021, "RB Leipzig", "แอร์เบ ไลป์ซิก"), job(2022, 2023, "Leeds United", "ลีดส์ ยูไนเต็ด"), job(2024, null, "Canada", "แคนาดา", "national"),
  ]),
  "gerardo-martino": career("ตาตา มาร์ติโนคว้าแชมป์กับนีเวลล์ส แอตแลนตา และอินเตอร์ ไมอามี รวมถึงเคยคุมบาร์เซโลนาและอาร์เจนตินา.", [
    job(2011, 2012, "Newell's Old Boys", "นีเวลล์ส โอลด์บอยส์", "manager", ["Argentine Primera División"]), job(2012, 2013, "Paraguay", "ปารากวัย", "national"),
    job(2013, 2014, "Barcelona", "บาร์เซโลนา", "manager", ["Supercopa de España"]), job(2014, 2016, "Argentina", "อาร์เจนตินา", "national"),
    job(2017, 2018, "Atlanta United", "แอตแลนตา ยูไนเต็ด", "manager", ["MLS Cup"]), job(2019, 2022, "Mexico", "เม็กซิโก", "national"), job(2023, 2025, "Inter Miami", "อินเตอร์ ไมอามี", "manager", ["Leagues Cup", "Supporters' Shield"]),
  ]),
  "marcelo-gallardo": career("กายาร์โดพาริเวอร์ เพลตคว้าลิเบอร์ตาดอเรสสองสมัย ก่อนทำงานกับอัล อิตติฮัดและกลับสู่ริเวอร์.", [
    job(2011, 2012, "Nacional", "นาซิอองนาล", "manager", ["Uruguayan Primera División"]), job(2014, 2022, "River Plate", "ริเวอร์ เพลต", "manager", ["Copa Libertadores ×2", "Copa Sudamericana"]),
    job(2023, 2024, "Al-Ittihad", "อัล อิตติฮัด"), job(2024, null, "River Plate", "ริเวอร์ เพลต"),
  ]),
  "fernando-santos": career("ซานโตสพาโปรตุเกสคว้าแชมป์ยูโร 2016 และเนชันส์ลีก 2019.", [
    job(1998, 2001, "Porto", "ปอร์โต", "manager", ["Taça de Portugal"]), job(2001, 2002, "AEK Athens", "เออีเค เอเธนส์"), job(2002, 2004, "Panathinaikos", "พานาธิไนกอส"),
    job(2010, 2014, "Greece", "กรีซ", "national"), job(2014, 2022, "Portugal", "โปรตุเกส", "national", ["Euros", "Nations League"]), job(2023, 2023, "Poland", "โปแลนด์", "national"), job(2024, 2025, "Azerbaijan", "อาเซอร์ไบจาน", "national"),
  ]),
  "carlo-anselotti-asia": career("คิม พัน-กอนพามาเลเซียพัฒนาผลงานระดับนานาชาติ ก่อนรับงานคุมอุลซาน ฮุนได.", [
    job(2009, 2014, "Hong Kong", "ฮ่องกง", "national"), job(2022, 2024, "Malaysia", "มาเลเซีย", "national"), job(2024, null, "Ulsan HD", "อุลซาน เอชดี"),
  ]),
  "tony-popovic": career("โปโปวิชพาเวสเทิร์น ซิดนีย์ วันเดอเรอร์สคว้าเอเอฟซีแชมเปียนส์ลีก และคุมทีมชาติออสเตรเลีย.", [
    job(2012, 2017, "Western Sydney Wanderers", "เวสเทิร์น ซิดนีย์ วันเดอเรอร์ส", "manager", ["AFC Champions League"]), job(2018, 2020, "Perth Glory", "เพิร์ท กลอรี"),
    job(2021, 2024, "Melbourne Victory", "เมลเบิร์น วิคตอรี"), job(2024, null, "Australia", "ออสเตรเลีย", "national"),
  ]),
  "walid-regragui": career("เรกรากีพาวีดัดคว้าแชมเปียนส์ลีกแอฟริกา และพาโมร็อกโกถึงรอบรองฟุตบอลโลก 2022.", [
    job(2014, 2019, "FUS Rabat", "เอฟยูเอส ราบัต", "manager", ["Moroccan Throne Cup"]), job(2021, 2022, "Wydad AC", "วีดัด เอซี", "manager", ["CAF Champions League"]),
    job(2022, null, "Morocco", "โมร็อกโก", "national"),
  ]),
  "steve-cooper": career("คูเปอร์พาอังกฤษรุ่นอายุไม่เกิน 17 ปีคว้าแชมป์โลก ก่อนพาฟอเรสต์กลับสู่พรีเมียร์ลีก.", [
    job(2015, 2019, "England U17", "อังกฤษ ยู17", "national", ["FIFA U-17 World Cup"]), job(2019, 2021, "Swansea City", "สวอนซี ซิตี้"),
    job(2021, 2023, "Nottingham Forest", "น็อตติงแฮม ฟอเรสต์", "manager", ["EFL Championship"]), job(2024, 2025, "Leicester City", "เลสเตอร์ ซิตี้"),
  ]),
  "gary-oneil": career("โอ'นีลเริ่มคุมทีมเต็มตัวกับบอร์นมัธ ก่อนสร้างผลงานแข็งแกร่งกับวูล์ฟส์.", [
    job(2022, 2023, "Bournemouth", "บอร์นมัธ"), job(2023, 2025, "Wolverhampton Wanderers", "วูล์ฟแฮมป์ตัน"),
  ]),
  "iraola-twin": career("มิเชล ซานเชซพาคิโรนาเลื่อนชั้นและสร้างผลงานท็อปโฟร์ลาลีกา ก่อนคุมเซบียา.", [
    job(2017, 2018, "Rayo Vallecano", "ราโย บาเยกาโน", "manager", ["Segunda División"]), job(2019, 2021, "Huesca", "อูเอสกา", "manager", ["Segunda División"]),
    job(2021, 2025, "Girona", "คิโรนา"), job(2025, null, "Sevilla", "เซบียา"),
  ]),
  "carlo-anselotti-ligue": career("วิล สติลล์เป็นกุนซือรุ่นใหม่ผู้สร้างชื่อกับแร็งส์ ก่อนคุมล็องส์และเซาแธมป์ตัน.", [
    job(2022, 2024, "Reims", "แร็งส์"), job(2024, 2025, "Lens", "ล็องส์"), job(2025, null, "Southampton", "เซาแธมป์ตัน"),
  ]),
  "adrien-rabiot-coach": career("วิเอร่ามีประสบการณ์คุมทีมจากนิวยอร์ก ซิตี้ นีซ คริสตัล พาเลซ สตราสบูร์ก และเจนัว.", [
    job(2016, 2018, "New York City FC", "นิวยอร์ก ซิตี้ เอฟซี"), job(2018, 2020, "Nice", "นีซ"), job(2021, 2023, "Crystal Palace", "คริสตัล พาเลซ"),
    job(2023, 2024, "Strasbourg", "สตราสบูร์ก"), job(2024, null, "Genoa", "เจนัว"),
  ]),
  "albert-stuvoy": career("สทอยเวนเบิร์กเป็นผู้ช่วยโค้ชคนสำคัญของอาร์เซนอล เคยทำงานกับทีมชาติเวลส์และแมนเชสเตอร์ ยูไนเต็ด.", [
    job(2016, 2018, "Wales", "เวลส์", "assistant"), job(2018, 2019, "Manchester United", "แมนเชสเตอร์ ยูไนเต็ด", "assistant"),
    job(2019, null, "Arsenal", "อาร์เซนอล", "assistant"),
  ]),
  "chris-wilder": career("ไวล์เดอร์พาเชฟฟิลด์ ยูไนเต็ดเลื่อนชั้นจากลีกวันถึงพรีเมียร์ลีกด้วยระบบโอเวอร์แลปเซ็นเตอร์แบ็ก.", [
    job(2008, 2012, "Oxford United", "อ็อกซ์ฟอร์ด ยูไนเต็ด", "manager", ["League Two"]), job(2014, 2016, "Northampton Town", "นอร์ทแธมป์ตัน ทาวน์", "manager", ["League Two"]),
    job(2016, 2021, "Sheffield United", "เชฟฟิลด์ ยูไนเต็ด", "manager", ["League One", "EFL Championship"]), job(2023, null, "Sheffield United", "เชฟฟิลด์ ยูไนเต็ด"),
  ]),
  "russell-martin": career("มาร์ตินพาสวอนซีและเซาแธมป์ตันเล่นฟุตบอลสร้างจากหลัง และพาเซาแธมป์ตันเลื่อนชั้น.", [
    job(2021, 2023, "Swansea City", "สวอนซี ซิตี้"), job(2023, 2024, "Southampton", "เซาแธมป์ตัน", "manager", ["EFL Championship"]),
  ]),
  "daniel-farke": career("ฟาร์เคพานอริชคว้าแชมเปียนชิพสองครั้ง และคุมลีดส์ ยูไนเต็ด.", [
    job(2017, 2021, "Norwich City", "นอริช ซิตี้", "manager", ["EFL Championship ×2"]), job(2022, 2023, "Borussia Mönchengladbach", "โบรุสเซีย มึนเชนกลัดบัค"),
    job(2023, null, "Leeds United", "ลีดส์ ยูไนเต็ด"),
  ]),
  "julen-lopetegui": career("โลเปเตกีพาสเปนชุดเยาวชนคว้าแชมป์ยุโรป ก่อนพาเซบียาคว้ายูโรปาลีกและคุมหลายสโมสรใหญ่.", [
    job(2010, 2014, "Spain U19/U21", "สเปน ยู19/ยู21", "national", ["UEFA U19 Championship ×2", "UEFA U21 Championship"]), job(2014, 2016, "Porto", "ปอร์โต"),
    job(2016, 2018, "Spain", "สเปน", "national"), job(2018, 2018, "Real Madrid", "เรอัล มาดริด"), job(2019, 2022, "Sevilla", "เซบียา", "manager", ["UEL"]),
    job(2022, 2023, "Wolverhampton Wanderers", "วูล์ฟแฮมป์ตัน"), job(2024, 2025, "West Ham United", "เวสต์แฮม ยูไนเต็ด"),
  ]),
  "quique-setien": career("เซเตียนขึ้นชื่อด้านฟุตบอลครองบอลจากลาส พัลมาสและเรอัล เบติส ก่อนรับงานคุมบาร์เซโลนา.", [
    job(2015, 2017, "Las Palmas", "ลาส ปัลมาส"), job(2017, 2019, "Real Betis", "เรอัล เบติส"), job(2020, 2020, "Barcelona", "บาร์เซโลนา"), job(2022, 2023, "Villarreal", "บียาร์เรอัล"),
  ]),
  "marcelino": career("มาร์เซลิโนพาบาเลนเซียคว้าโกปา เดล เรย์ และพาบียาร์เรอัลคว้าแชมป์ยูโรปาลีก.", [
    job(2006, 2011, "Racing Santander", "ราซิง ซานตันเดร์"), job(2013, 2016, "Villarreal", "บียาร์เรอัล"), job(2017, 2019, "Valencia", "บาเลนเซีย", "manager", ["Copa del Rey"]),
    job(2021, 2022, "Athletic Club", "แอธเลติก บิลเบา", "manager", ["Supercopa de España"]), job(2023, 2024, "Marseille", "มาร์กเซย"), job(2025, null, "Villarreal", "บียาร์เรอัล", "manager", ["UEL"]),
  ]),
  "steve-clarke": career("คลาร์กคุมทีมชาติสกอตแลนด์ผ่านเข้ารอบสุดท้ายยูโรติดต่อกัน หลังเคยคุมเวสต์บรอมวิชและเรดิง.", [
    job(2011, 2012, "West Bromwich Albion", "เวสต์บรอมวิช อัลเบียน"), job(2012, 2013, "Reading", "เรดดิง"), job(2019, null, "Scotland", "สกอตแลนด์", "national"),
  ]),
  "craig-bellamy": career("เบลลามีเริ่มงานคุมทีมชาติเวลส์หลังผ่านงานโค้ชเยาวชนและผู้ช่วยกับอันเดอร์เลชท์.", [
    job(2021, 2024, "Anderlecht", "อันเดอร์เลชท์", "assistant"), job(2024, null, "Wales", "เวลส์", "national"),
  ]),
  "heimir-hallgrimsson": career("ฮัลล์กริมส์สันพาไอซ์แลนด์ไปยูโร 2016 และฟุตบอลโลก 2018 ก่อนคุมจาเมกาและไอร์แลนด์.", [
    job(2013, 2016, "Iceland", "ไอซ์แลนด์", "assistant"), job(2016, 2018, "Iceland", "ไอซ์แลนด์", "national"), job(2022, 2024, "Jamaica", "จาเมกา", "national"), job(2024, null, "Republic of Ireland", "สาธารณรัฐไอร์แลนด์", "national"),
  ]),
  "rudi-garcia": career("การ์เซียพาลีลล์คว้าดับเบิลในฝรั่งเศส และพาโรมากับมาร์กเซยเข้ารอบลึกในยุโรป.", [
    job(2008, 2013, "Lille", "ลีลล์", "manager", ["Ligue 1", "Coupe de France"]), job(2013, 2016, "Roma", "โรมา"), job(2016, 2019, "Marseille", "มาร์กเซย"),
    job(2019, 2021, "Lyon", "ลียง"), job(2022, 2023, "Al-Nassr", "อัล นาสเซอร์"), job(2023, 2024, "Napoli", "นาโปลี"), job(2025, null, "Belgium", "เบลเยียม", "national"),
  ]),
  "nestor-lorenzo": career("ลอเรนโซพาโคลอมเบียเข้าชิงโคปา อเมริกา 2024 หลังมีประสบการณ์คุมสโมสรในเปรูและอาร์เจนตินา.", [
    job(2019, 2021, "Melgar", "เมลการ์"), job(2021, 2022, "FBC Melgar", "เอฟบีซี เมลการ์"), job(2022, null, "Colombia", "โคลอมเบีย", "national"),
  ]),
  "javier-aguirre": career("อากีร์เรคุมเม็กซิโกหลายวาระและมีประสบการณ์ยาวนานในลาลีกากับหลายสโมสร.", [
    job(2001, 2002, "Mexico", "เม็กซิโก", "national"), job(2002, 2006, "Osasuna", "โอซาซูนา"), job(2006, 2009, "Atlético Madrid", "แอตเลติโก มาดริด"),
    job(2009, 2010, "Mexico", "เม็กซิโก", "national"), job(2010, 2014, "Zaragoza/Espanyol", "ซาราโกซา/เอสปันญอล"), job(2015, 2017, "UAE", "สหรัฐอาหรับเอมิเรตส์", "national"),
    job(2019, 2020, "Leganés", "เลกาเนส"), job(2024, null, "Mexico", "เม็กซิโก", "national", ["CONCACAF Nations League", "Gold Cup"]),
  ]),
  "hong-myung-bo": career("ฮง มย็อง-โบพาอุลซานคว้าแชมป์เคลีก ก่อนกลับมาคุมทีมชาติเกาหลีใต้.", [
    job(2012, 2013, "South Korea", "เกาหลีใต้", "national"), job(2020, 2024, "Ulsan HD", "อุลซาน เอชดี", "manager", ["K League 1 ×2"]), job(2024, null, "South Korea", "เกาหลีใต้", "national"),
  ]),
  "eric-chelle": career("เชลเล่เคยคุมทีมชาติมาลี ก่อนรับงานคุมทีมชาติไนจีเรีย.", [
    job(2022, 2024, "Mali", "มาลี", "national"), job(2025, null, "Nigeria", "ไนจีเรีย", "national"),
  ]),
  "pape-thiaw": career("ป๊าป เธียวเริ่มคุมทีมชาติเซเนกัลหลังประสบการณ์กับทีมเยาวชนและสโมสรในประเทศ.", [
    job(2024, null, "Senegal", "เซเนกัล", "national"),
  ]),
  "hossam-hassan": career("ฮอสซัม ฮัสซันเคยคุมหลายสโมสรในอียิปต์ ก่อนรับงานทีมชาติอียิปต์.", [
    job(2011, 2013, "Al Masry", "อัล มาสรี"), job(2013, 2014, "Zamalek", "ซามาเล็ค"), job(2024, null, "Egypt", "อียิปต์", "national"),
  ]),
  "zlatko-dalic": career("ดาลิชพาโครเอเชียเข้าชิงฟุตบอลโลก 2018 และจบอันดับสามในปี 2022.", [
    job(2014, 2017, "Al-Ain", "อัล ไอน์", "manager", ["UAE Pro League"]), job(2017, null, "Croatia", "โครเอเชีย", "national"),
  ]),
  "brian-riemer": career("รีเมอร์ทำงานในทีมงานของเบรนท์ฟอร์ด ก่อนคุมอันเดอร์เลชท์และทีมชาติเดนมาร์ก.", [
    job(2018, 2022, "Brentford", "เบรนท์ฟอร์ด", "assistant"), job(2022, 2024, "Anderlecht", "อันเดอร์เลชท์"), job(2024, null, "Denmark", "เดนมาร์ก", "national"),
  ]),
  "jon-dahl-tomasson": career("โทมัสสันพามัลโมคว้าแชมป์ลีกสวีเดน ก่อนคุมแบล็กเบิร์นและทีมชาติสวีเดน.", [
    job(2020, 2021, "Malmö FF", "มัลโม เอฟเอฟ", "manager", ["Allsvenskan ×2"]), job(2022, 2024, "Blackburn Rovers", "แบล็กเบิร์น โรเวอร์ส"), job(2024, null, "Sweden", "สวีเดน", "national"),
  ]),
  "stale-solbakken": career("โซลบัคเคนพาโคเปนเฮเกนคว้าแชมป์เดนมาร์กหลายสมัย และคุมทีมชาตินอร์เวย์.", [
    job(2006, 2011, "Copenhagen", "โคเปนเฮเกน", "manager", ["Danish Superliga ×5"]), job(2012, 2013, "Wolverhampton Wanderers", "วูล์ฟแฮมป์ตัน"),
    job(2013, 2020, "Copenhagen", "โคเปนเฮเกน", "manager", ["Danish Superliga ×3"]), job(2020, null, "Norway", "นอร์เวย์", "national"),
  ]),
  "murat-yakin": career("ยาคินคว้าแชมป์ลีกสวิตเซอร์แลนด์กับบาเซิล และพาสวิตเซอร์แลนด์ทำผลงานดีในยูโร 2024.", [
    job(2012, 2014, "Basel", "บาเซิล", "manager", ["Swiss Super League ×2"]), job(2018, 2021, "Schaffhausen", "ชาฟฟ์เฮาเซน"), job(2021, null, "Switzerland", "สวิตเซอร์แลนด์", "national"),
  ]),
  "michal-probierz": career("โปรเบียร์ซคุมหลายสโมสรในโปแลนด์ ก่อนรับงานคุมทีมชาติโปแลนด์.", [
    job(2012, 2014, "Lechia Gdańsk", "เลเชีย กดัญสก์"), job(2017, 2021, "Cracovia", "คราโคเวีย", "manager", ["Polish Cup"]), job(2023, null, "Poland", "โปแลนด์", "national"),
  ]),
  "vincenzo-montella": career("มอนเตลลาคุมหลายสโมสรในอิตาลีและตุรกี ก่อนพาทีมชาติตุรกีเข้าถึงรอบก่อนรองยูโร 2024.", [
    job(2011, 2013, "Catania", "คาตาเนีย"), job(2013, 2015, "Fiorentina", "ฟิออเรนตินา"), job(2015, 2016, "Sampdoria", "ซามพ์โดเรีย"),
    job(2016, 2017, "AC Milan", "เอซี มิลาน", "manager", ["Supercoppa Italiana"]), job(2017, 2018, "Sevilla", "เซบียา"), job(2019, 2021, "Fiorentina", "ฟิออเรนตินา"),
    job(2021, 2023, "Adana Demirspor", "อดานา เดมีร์สปอร์"), job(2023, null, "Turkey", "ตุรกี", "national"),
  ]),
  "dragan-stojkovic": career("สตอยโควิชคว้าแชมป์ลีกจีนกับกว่างโจว และพาเซอร์เบียผ่านเข้าสู่ฟุตบอลโลก 2022.", [
    job(2008, 2015, "Nagoya Grampus", "นาโกยา แกรมปัส", "manager", ["J1 League"]), job(2015, 2020, "Guangzhou R&F", "กว่างโจว อาร์แอนด์เอฟ"), job(2021, null, "Serbia", "เซอร์เบีย", "national"),
  ]),
  "ivan-jovanovic": career("โยวาโนวิชคว้าแชมป์ลีกกับอาโปเอลและพาทีมไปแชมเปียนส์ลีก ก่อนคุมทีมชาติกรีซ.", [
    job(2008, 2013, "APOEL", "อาโปเอล", "manager", ["Cypriot First Division ×4"]), job(2013, 2016, "Al-Nasr", "อัล นาสร์"), job(2024, null, "Greece", "กรีซ", "national"),
  ]),
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({ version: 1, byId }, null, 2)}\n`, "utf8");
console.log(`Wrote ${Object.keys(byId).length} coach careers to ${output}`);
