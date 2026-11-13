@content @front-end
Feature: Content on the front end
  As a tester of a site
  I want to assert teasers, tags, the published state, blocks, the layout template and the theme of a page
  So that what visitors see of the content is covered

  Scenario: A teaser of the home page opens its content
    Given I am on the homepage
    Then I should see the teaser "Field note 12"
    When I open the teaser "Field note 12"
    Then the page heading should be "Field note 12"
    And the content on the page should be published
    And the content on the page should not be unpublished

  Scenario: Content shows its tags and a tag lists its content
    Given I am on "/posts/field-note-12"
    Then the content on the page should be tagged "Hives"
    And the content on the page should not be tagged "Honey"
    When I click "Hives"
    Then the page heading should be "Hives"
    And I should see the teaser "Field note 12"
    And I should not see the teaser "Field note 11"

  Scenario: Unpublished content is marked for the accounts that may see it
    Given I am logged in as "editor"
    When I view the content "Unpublished field note"
    Then the content on the page should be unpublished
    And the content on the page should not be published
    And I should see "This Post is unpublished."

  Scenario: The home page and the other pages use their own layout
    Given I am on the homepage
    Then the page should use the "Boxton" layout template
    And the page should not use the "Moscone Flipped" layout template
    When I go to "/visit-the-apiary"
    Then the page should use the "Moscone Flipped" layout template
    And the page should use the "moscone_flipped" layout template

  Scenario: The site and its administration use their own theme
    Given I am logged in as "admin"
    And I am on the homepage
    Then the page should use the "basis" theme
    And the page should not use the "seven" theme
    When I go to the "content" administration page
    Then the page should use the "seven" theme

  Scenario: Blocks of a layout show with their title
    Given I am on "/visit-the-apiary"
    Then I should see the block titled "Search"
    And I should not see the block titled "User login"
    Given I am logged in as "admin"
    Then I should see the block titled "Create content"
    And I should see the block titled "Content overview"
