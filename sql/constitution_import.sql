-- Replace the Constitution (a draft, no amendments) with the SAO club constitution template. A backup of the old text is in sql/backups/.
-- Clauses may now have no heading: the template's clauses are plain numbered paragraphs. An article title is stored as C-n.0.

alter table activities.policy_clauses drop constraint if exists policy_clauses_heading_check;
alter table activities.policy_clauses add constraint policy_clauses_heading_check check (length(heading) <= 160);

delete from activities.policy_clauses where doc_id = (select id from activities.policy_docs where slug = 'constitution' and status = 'draft');

insert into activities.policy_clauses (doc_id, ref, ord, heading, body_md) values
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-1.0$b$, 10, $b$Name$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-1.1$b$, 20, $b$$b$, $b$This Student Organisation shall be known as the “\_\_\_\_”, hereinafter referred to as the “Student Organisation”.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-2.0$b$, 30, $b$Place of business$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-2.1$b$, 40, $b$$b$, $b$Its place of business shall be at “\_\_\_\_” or such other address as may subsequently be decided upon by the Committee and approved by Student Affairs Office. The Student Organisation shall carry out its activities only in places and premises which have the prior written approval from the relevant authorities, where necessary.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-3.0$b$, 50, $b$Objects$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-3.1$b$, 60, $b$$b$, $b$Its objects are:$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-4.0$b$, 70, $b$Membership qualification and rights$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-4.1$b$, 80, $b$$b$, $b$Membership is open to all NTU undergraduate [and graduate students (delete where applicable)].$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-4.2$b$, 90, $b$$b$, $b$Ordinary Members

1. Membership is open to all full-time matriculated undergraduate students of Nanyang Technological University (NTU).
1. Ordinary Members shall have the right to vote and to hold office in the Student Organisation.
1. Ordinary Members shall be entitled to attend events organised by the Student Organisation.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-4.3$b$, 100, $b$$b$, $b$[Associate Members (delete where applicable)]

1. Membership is open to all part-time undergraduate, full-time and part-time graduate, non-graduating and exchange students of Nanyang Technological University (NTU).
1. Associate Members shall be entitled to attend events organised by the Student Organisation.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-5.0$b$, 110, $b$Application for membership$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-5.1$b$, 120, $b$$b$, $b$A person wishing to join the Student Organisation should submit his particulars to the Secretary on a prescribed form.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-5.2$b$, 130, $b$$b$, $b$The Committee will decide on the application for membership.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-5.3$b$, 140, $b$$b$, $b$A copy of the Constitution shall be furnished to every approved member [upon payment of the entrance fee (delete where applicable)].$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-6.0$b$, 150, $b$Entrance fees, membership fee and other dues$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-6.1$b$, 160, $b$$b$, $b$\*[There shall be no entrance fee payable for all members.

**OR**

An entrance fee of $\_\_\_\_ is payable within two (2) weeks of approval of membership, in default of which membership may be cancelled by order of the Committee.]$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-6.2$b$, 170, $b$$b$, $b$\*[There shall be no membership fee payable by members. The funds of the Student Organisation shall be derived from free-will offerings / voluntary donations.

**OR**

Annual membership fee of $\_\_\_\_ is payable in advance.]$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-6.3$b$, 180, $b$$b$, $b$\*[If a member falls into arrears with his membership fee or other dues, he shall be informed immediately by the Treasurer. If he fails to settle his arrears within \_\_\_\_ weeks of their becoming due, the President may order that he be denied the privileges of membership until he settles his account. If he falls into arrears for more than three (3) months, he will automatically cease to be a member.]$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-6.4$b$, 190, $b$$b$, $b$\*[The entrance fees and membership fee shall be determined by the General Meeting on recommendation from the Committee from time to time.] Any additional fund required for special purposes may only be raised from members with the consent of the General Meeting of members.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-7.0$b$, 200, $b$Supreme authority and general meetings$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-7.1$b$, 210, $b$$b$, $b$The supreme authority of the Student Organisation is vested in a General Meeting of members presided over by the President.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-7.2$b$, 220, $b$$b$, $b$An Annual General Meeting shall be held within six (6) weeks of the Academic Year.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-7.3$b$, 230, $b$$b$, $b$At other times, an Extraordinary General Meeting must be called by the President on the request in writing of not less than twenty-five percent (25%) of the total voting membership or thirty (30) voting members, whichever is the lesser, and may be called at anytime by order of the Committee. The notice in writing shall be given to the Secretary setting forth the business that is to be transacted. The Extraordinary General Meeting shall be convened within one (1) month from receiving this request to convene the Extraordinary General Meeting.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-7.4$b$, 240, $b$$b$, $b$If the Committee does not within one (1) month after the date of the receipt of the written request proceed to convene an Extraordinary General Meeting, the members who requested for the Extraordinary General Meeting shall convene the Extraordinary General Meeting by giving ten (10) days' notice to voting members, furnishing the agenda, via reasonable means of communication.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-7.5$b$, 250, $b$$b$, $b$At least two (2) weeks' notice shall be given of an Annual General Meeting and at least ten (10) days' notice of an Extraordinary General Meeting. Notice of meeting stating the date, time and place of meeting shall be sent by the Secretary to all voting members. The agenda shall be furnished at least four (4) days in advance of the meeting.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-7.6$b$, 260, $b$$b$, $b$Voting by proxy shall not be allowed at all General Meetings.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-7.7$b$, 270, $b$$b$, $b$The following points will be considered at the Annual General Meeting:

1. The previous financial year's accounts and annual report of the Committee.
1. Where applicable, the investiture of the new office bearers for the following term.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-7.8$b$, 280, $b$$b$, $b$Any member who wishes to place an item on the agenda of a General Meeting shall give notice to the Secretary one (1) week before the meeting is due to be held.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-7.9$b$, 290, $b$$b$, $b$At least twenty-five percent (25%) of the total voting membership or thirty (30) voting members, whichever is the lesser, present at a General Meeting shall form a quorum. Proxies shall not be constituted as part of the quorum.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-7.10$b$, 300, $b$$b$, $b$In the event of there being no quorum at the commencement of a General Meeting, the meeting shall be adjourned for thirty (30) minutes and should the number then present be insufficient to form a quorum, those present shall be considered a quorum, but they shall have no power to amend any of the existing Constitution.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-7.11$b$, 310, $b$$b$, $b$Except for special circumstances, these meetings should preferably not be convened during the University vacations. Such meetings can also be held in online mode to encourage more participation from members who may otherwise not be able to attend the meeting physically. Student Affairs Office and the Student Organisation Advisor to be consulted and proper procedures for meetings would have to be established by the committee.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-8.0$b$, 320, $b$Management and committee$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-8.1$b$, 330, $b$$b$, $b$The administration of the Student Organisation shall be entrusted to a Management Committee consisting of the following positions:

1. A President
1. A Vice-President
1. A Secretary
1. A Treasurer
1. A publicity and publication officer$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-8.2$b$, 340, $b$$b$, $b$A Committee Meeting shall be held at least once every month after giving seven (7) days' notice to Committee Members. The President may call a Committee Meeting at any time by giving five (5) days' notice. At least half (1/2) of the Committee Members must be present for its proceedings to be valid.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-8.3$b$, 350, $b$$b$, $b$Any member of the Committee absenting himself from three (3) meetings consecutively without satisfactory explanations shall be deemed to have withdrawn from the Committee. The Committee shall consult Student Affairs Office and the Student Organisation Advisor concerning the withdrawal within two (2) weeks. A replacement may be made through a By-Election, or Appointment by the Management Committee to serve until the next Election with the exception of the President, Vice-President, Secretary and Treasurer which must be elected through a By-Election. The Student Organisation shall then notify its members about the changes in position.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-8.4$b$, 360, $b$$b$, $b$A vote of no-confidence can be carried out to remove any member of the Management Committee, only after consultation with Student Affairs Office and the Student Organisation Advisor. The member shall be removed from the Management Committee if the vote passed by no less than three quarters (3/4) of the total number of Management Committee members present in the meeting.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-8.5$b$, 370, $b$$b$, $b$Upon removal of a member of the Management Committee, the President has the authority to, in consultation with the Student Organisation Advisor and with the approval from Student Affairs Office:

1. Appoint a member of the student organisation to fill the vacancy in the Management Committee, or
1. Leave the position vacant and distribute the workload among the remaining members of the Management Committee.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-8.6$b$, 380, $b$$b$, $b$The duty of the Committee is to organise and supervise the day-to-day activities of the Student Organisation. The Committee may not act contrary to the expressed wishes of the General Meeting of members without prior reference to it and always remains subordinate to the General Meetings of members.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-8.7$b$, 390, $b$$b$, $b$The Committee has power to authorise the expenditure from the Student Organisation's funds for the Student Organisation's purposes.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-9.0$b$, 400, $b$Duties of office bearers$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-9.1$b$, 410, $b$$b$, $b$The President shall chair all General and Committee meetings and have general oversight of all events and activities of the Student Organisation. He shall also countersign all bills passed by the Treasurer.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-9.2$b$, 420, $b$$b$, $b$The Vice-President shall assist the President and deputise for him in his absence. He shall be the Safety Officer and ensure the Student Organisation complies with University’s Safety Policies and guidelines.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-9.3$b$, 430, $b$$b$, $b$The Secretary shall keep all records, except financial, of the Student Organisation and shall be responsible for their correctness. He will keep minutes of all General and Committee meetings. He shall maintain an up-to-date Register of Members at all times. He shall be the Data Protection Officer and ensure the Student Organisation complies with Personal Data Protection Act (PDPA).$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-9.4$b$, 440, $b$$b$, $b$The Treasurer shall keep all funds, collect and disburse all money on behalf of the Student Organisation and shall keep an account of all monetary transactions and be responsible for their correctness. He shall be responsible for proper bookkeeping in compliance with the annual audit checks.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-9.5$b$, 450, $b$$b$, $b$Publicity and Publication Officer shall be responsible for the Student Organisation’s publicity and publications in accordance with the Copyright Act.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-9.6$b$, 460, $b$$b$, $b$\*[The \_\_\_\_ Officer shall \_\_\_\_ ]$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.0$b$, 470, $b$Election$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.1$b$, 480, $b$$b$, $b$The annual election shall be carried out by the 4th week of each Academic Year, in-person or by electronic means.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.2$b$, 490, $b$$b$, $b$The Management Committee shall appoint the Election Committee to supervise and conduct the Election of the Management Committee at least one (1) month before the 1st semester of each Academic Year.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.3$b$, 500, $b$$b$, $b$Each Election Committee shall comprise one (1) Returning Officer and at least two (2) Election Officers.

1. The Returning Officer shall be the Chairperson of the Election Committee and the Election Officers shall assist the Returning Officer.
1. The Returning Officer and Election Officers shall not stand for election to that Management Committee.
1. The Returning Officer and Election Officers shall not be a proposer or seconder for any candidate’s nomination forms for that Management Committee.
1. The Returning Officer and Election Officers shall not campaign for any of the candidates standing for election to that Management Committee.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.4$b$, 510, $b$$b$, $b$Each Election Committee shall:

1. Supervise and conduct the Election.
1. Give notice of the Election no less than seven (7) days before the start of the nomination period.
1. Announce to the Members the date, time, and method of receiving nomination forms. Such date and time shall be the end of the nomination period for that Management Committee.
1. Announce to the Members the results of the Election no later than three (3) days after its conclusion.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.5$b$, 520, $b$$b$, $b$Each Election Committee shall have the power to:

1. Accept the nomination of any candidate at any point in time during the entire nomination period, provided that the candidate fulfils the eligibility requirement.
1. Accept the withdrawal of any candidate at any point in time from the start of the nomination period to the conclusion of the entire election process.
1. Declare the election of any candidate of the Management Committee invalid due to procedural irregularities.
1. Make decisions that encourage the spirit of ensuring a fair and transparent election. Such decisions shall only be made under exceptional circumstances that arise during the entire election process.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.6$b$, 530, $b$$b$, $b$All disputes between any Management Committee candidate and the Election Committee shall be adjudicated by the Election Committee. In the event of a stalemate, the Election Committee will make the final decision, after consultation with Student Affairs Office. The decision(s) shall be final and binding on all parties involved. There shall be no appeal, nor right to appeal, to such decision(s).$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.7$b$, 540, $b$$b$, $b$**Electoral Procedure**

The Election process shall not exceed thirty (30) days and shall consist of the following main components:

1. Election notification publicity;
1. Nomination period;
1. Campaigning period, which includes a Rally;
1. Voting period;$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.8$b$, 550, $b$$b$, $b$The Student Organisation shall publicise the following to its members, using reasonable means:

1. Members of the Election Committee;
1. Electoral procedure; and
1. Results of the Election.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.9$b$, 560, $b$$b$, $b$**Nomination Period**

There shall be a nomination period when interested candidates may apply to stand for Election.

1. The nomination period shall last no less than three (3) days and no more than fourteen (14) days.
1. The details of the Nomination Period and positions vacant for elections shall be made known to all members by the Election Committee using any reasonable means of communication.
1. All nominees shall be proposed and seconded.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.10$b$, 570, $b$$b$, $b$Applicants for the Election must be ordinary members of the Student Organisation.

1. Candidate who has been found guilty of a disciplinary offence under the provisions of Statute 6 (Student Discipline) is not eligible to apply.
1. Candidate who is placed on academic probation in the year of election shall not be eligible to apply.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.11$b$, 580, $b$$b$, $b$All members of the Management Committee, except the Treasurer, shall be eligible for re-election for any position in the following term. The outgoing Treasurer is eligible to seek re-election for any position other than that of the Treasurer.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.12$b$, 590, $b$$b$, $b$Any candidate whose nomination forms are rejected by the Election Committee may request a review by the Management Committee.

1. The rejection of the candidate’s nomination forms shall be made known to the candidate no more than one (1) day after the end of the nomination period. The request to review such a decision shall be made by the candidate no more than two (2) days after the end of the nomination period. The decision of the Management Committee on the matter shall be made known to the candidate no more than three (3) days after the end of the nomination period.
1. The decision of such review(s) shall be binding and final on all parties. The Election shall be held on the stipulated date(s), notwithstanding the review(s).
1. The validity of a nomination form(s) is dependent on its adherence to the procedures laid out by the Election Committee$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.13$b$, 600, $b$$b$, $b$**Campaigning Period**

The campaigning period shall last no less than seven (7) days and no more than twenty (20) days.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.14$b$, 610, $b$$b$, $b$Campaign materials are only allowed at specific locations / platforms as determined by the Election Committee.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.15$b$, 620, $b$$b$, $b$Any campaign material which bears content that is deemed offensive, provocative, malicious, false, morally objectionable, or are related to ethnicity, gender, race, religion, politics or violence in any way will be removed immediately without notice to the candidate who puts up the campaign material. Any candidate who publishes such material shall be disqualified.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.16$b$, 630, $b$$b$, $b$**Cooling-off Period**

There shall be one (1) day set aside for cooling-off after the end of the campaigning period. All campaigning materials, including and not limited to virtual material such as posts, stories and highlights on social media, should be removed from public view. Candidates found campaigning on these days shall be disqualified from elections.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.17$b$, 640, $b$$b$, $b$**Voting Period**

The duration of the voting period shall be no less than one (1) day and no more than four (4) days.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.18$b$, 650, $b$$b$, $b$Lobbying for votes shall not be allowed.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.19$b$, 660, $b$$b$, $b$Voting by proxy shall not be allowed.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.20$b$, 670, $b$$b$, $b$Election shall follow a simple majority vote of the members.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.21$b$, 680, $b$$b$, $b$**Results of Elections**

The results of the Election shall be announced no later than three (3) days after its conclusion.

1. Both number of votes and percentages of votes are to be released.
1. In the event of a tie, the Election Committee will call a By-Election with the candidates in question. If the By-Election still ends in a tie, the outgoing Management Committee shall make the final decision.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.22$b$, 690, $b$$b$, $b$**By-Elections**

Should there be any position(s) in the Management Committee that is/are unfilled after Election, a By-Election is to be held.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.23$b$, 700, $b$$b$, $b$Candidates who are not elected in the Election are allowed to submit applications for the By-Election.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.24$b$, 710, $b$$b$, $b$The By-Election process shall consist of:

1. The Nomination period;
1. The Campaigning period, which includes a Rally;
1. The Voting period.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.25$b$, 720, $b$$b$, $b$The duration of the nomination period shall be no less than one (1) day and no more than seven (7) days.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.26$b$, 730, $b$$b$, $b$The duration of the campaigning period shall be no less than three (3) days and no more than seven (7) days.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.27$b$, 740, $b$$b$, $b$The duration of the voting period shall be no less than one (1) day and no more than four (4) days.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-10.28$b$, 750, $b$$b$, $b$The Returning Officer shall, in the event that there is no applicant for the By-Election, with the exception for the posts of President, Vice-President, Secretary and Treasurer, declare the application for the position in the Management Committee closed.

1. The posts of President, Vice-President, Secretary and Treasurer shall be filled through Election.
1. Appointment must be proposed to Student Affairs Office for approval. Appointed Office Bearer/s shall have no voting rights at Management Committee meetings.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-11.0$b$, 760, $b$Audit and financial year$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-11.1$b$, 770, $b$$b$, $b$\*[A firm of Public Accountants and Chartered Accountants shall be appointed as Auditors at each Annual General Meeting for a term of one (1) year and shall be eligible for reappointment.]

**OR**

\*[The Auditors shall be appointed by the University for the Student Organisation’s annual accounts for a term of one (1) year and shall be eligible for reappointment.]$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-11.2$b$, 780, $b$$b$, $b$The Auditors:

1. Will be required to audit each year's accounts and present a report upon them to the Annual General Meeting.
1. May be required by the President to audit the Student Organisation's accounts for any period within their tenure of office at any date and make a report to the Committee.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-11.3$b$, 790, $b$$b$, $b$The financial year shall be from 1 September to 31 August of the following year.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-12.0$b$, 800, $b$Resignation$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-12.1$b$, 810, $b$$b$, $b$All office bearers shall hold office from the time of their election to the Annual General Meeting following.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-12.2$b$, 820, $b$$b$, $b$Any office bearers seeking to resign from his office shall tender his resignation in writing to the Management Committee and shall not deemed to have resigned until his resignation is reviewed and accepted by the Management Committee.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-12.3$b$, 830, $b$$b$, $b$Where a resignation is accepted by the Management Committee, the ensuing vacancy shall be filled by the Management Committee through appointment, except for the President, Vice-President, Secretary and Treasurer. The appointed committee members will not have voting rights. For the replacement of the positions of President, Vice-President, Secretary, Treasurer, the Student Organisation is to consult Student Affairs Office and the Student Organisation Advisor.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-13.0$b$, 840, $b$Prohibitions$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-13.1$b$, 850, $b$$b$, $b$The funds of the Student Organisation shall not be used to pay the fines of members who have been convicted in court of law.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-13.2$b$, 860, $b$$b$, $b$The Student Organisation shall not engage in any trade union activity as defined in any written law relating to trade unions for the time being in force in Singapore.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-13.3$b$, 870, $b$$b$, $b$The Student Organisation shall not indulge in any political activity or allow its funds and/or premises to be used for political purposes.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-13.4$b$, 880, $b$$b$, $b$The Student Organisation shall not raise funds from the public for whatever purposes without the prior approval in writing of the relevant authorities, where necessary.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-14.0$b$, 890, $b$Statement to the press$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-14.1$b$, 900, $b$$b$, $b$Press releases or matters within the province of the Student Organisation and related to its members shall be made by the President or Vice-President after due consultation with the Management Committee, Student Organisation Advisor, Student Affairs Office and Corporate Communications Office.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-15.0$b$, 910, $b$Amendments to constitution$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-15.1$b$, 920, $b$$b$, $b$No alteration or addition/deletion to this Constitution shall be made except at a General Meeting and with the consent of two-thirds (2/3) of the voting members present at the General Meeting, and they shall come into force upon the final approval of the Director of Student Affairs Office.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-15.2$b$, 930, $b$$b$, $b$A period of at least five years must pass after the most recent amendment(s) to the Constitution before any new proposals, including amendments or even the complete revocation of the Constitution, can be submitted for review by the Student Affairs Office. Nevertheless, within this five-year timeframe, the Management Committee has the option to submit proposed amendments specifically for the consideration of the incoming Management Committee that will assume office at the end of the five-year timeframe.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-16.0$b$, 940, $b$Interpretation$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-16.1$b$, 950, $b$$b$, $b$In the event of any question or matter pertaining to day-to-day administration which is not expressly provided for in this Constitution, the Committee shall have power to use its own discretion. The decision of the Committee shall be final unless it is reversed at a General Meeting of members.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-17.0$b$, 960, $b$Disputes$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-17.1$b$, 970, $b$$b$, $b$In the event of any dispute arising amongst members, they shall attempt to resolve the matter at an Extraordinary General Meeting in accordance with this Constitution. Should the members fail to resolve the matter, they may bring the matter to the Student Organisation Advisor and Student Affairs Office for settlement.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-18.0$b$, 980, $b$Measures for constitutional non-compliance$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-18.1$b$, 990, $b$$b$, $b$All members shall be bound by the existing Articles in this Constitution.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-18.2$b$, 1000, $b$$b$, $b$Measures may be taken against any member who violates any of the Articles of the Constitution or acts in any way derogatory to the student organisation. Measures proposed by the Management Committee, upon consultation with the Student Affairs Office and Student Organisation Advisor, may include the following:

1. Issuance of warning letter.
1. A suspension from any or all of the privileges of membership for the current term.
1. A termination of office for office bearers, including the Management Committee, Sub- Committee.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-19.0$b$, 1010, $b$Dissolution$b$, $b$$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-19.1$b$, 1020, $b$$b$, $b$The Student Organisation shall not be dissolved, except with the consent of not less than three-fifth (3/5) of the total voting membership of the Student Organisation, at a General Meeting convened for the purpose.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-19.2$b$, 1030, $b$$b$, $b$In the event of the Student Organisation being dissolved as provided above, all debts and liabilities legally incurred on behalf of the Student Organisation shall be fully discharged, and the remaining funds shall be donated to the NTU Student Activities Fund or to an approved charity or charities in Singapore.$b$),
((select id from activities.policy_docs where slug = 'constitution' and status = 'draft'), $b$C-19.3$b$, 1040, $b$$b$, $b$The minutes of the General Meeting and a statement of accounts shall be submitted within seven (7) days of the dissolution to Student Affairs Office.$b$);

update activities.policy_docs set summary = $b$The founding rules: name, membership, general meetings, the committee, elections, finances, amendments and dissolution. Based on the Student Affairs Office template; fill in the blanks before publishing.$b$, published = false, updated_at = now() where slug = 'constitution' and status = 'draft';
